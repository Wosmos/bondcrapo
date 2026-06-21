import type { Metal } from "@bondcheck/shared";
import {
  fxOn,
  insertSpotTicks,
  latestFxDate,
  latestSpotPerMetal,
  pruneRateLimitsBefore,
  pruneSpotBefore,
  rollMetalDaily,
  upsertFxDaily,
  upsertLocalRates,
  upsertPkrQuotes,
} from "@bondcheck/db/queries/markets";
import type { Job, JobContext, JobResult } from "../job";
import { countryByCode, localDate } from "./countries";
import { derivedPrice } from "./derive";
import { deriveLocalRates, pakistanUsdRate, type DeriveResult } from "./derive-job";
import { appGoldProvider } from "./providers/app-gold";
import { fxReferenceProviders } from "./providers/fx";
import { forexPkProvider } from "./providers/forex-pk";
import { metalSpotProviders } from "./providers/metals";
import { sbpEcapProvider, sbpM2mProvider, sbpWacerProvider } from "./providers/sbp";
import {
  AllProvidersFailedError,
  firstAvailable,
  type FxSnapshot,
  type MarketsEnv,
  type PkrQuote,
  type PriceProvider,
  type ProviderContext,
  type ReportedBatch,
  type SpotQuote,
} from "./types";
import { checkPkrQuotes, checkReported, checkSpot, requireGold, validateFxSnapshot } from "./validate";

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function providerContext(ctx: JobContext, env: MarketsEnv): ProviderContext {
  return { fetcher: ctx.fetcher, now: ctx.now(), env };
}

/** Records provider errors of a fallback chain as warnings (they did not stop the run). */
async function reportErrors(ctx: JobContext, dataset: string, errors: { provider: string; message: string }[], severity: "warn" | "error" = "warn") {
  for (const e of errors) {
    await ctx.issue({ severity, entity: dataset, entityKey: e.provider, message: e.message });
  }
}

async function chainDerive(ctx: JobContext): Promise<DeriveResult | { error: string }> {
  try {
    const r = await deriveLocalRates(ctx.db, ctx.now());
    for (const s of r.skipped) {
      await ctx.issue({ severity: "warn", entity: "local-rates", entityKey: s.country, message: s.reason });
    }
    return r;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.issue({ severity: "error", entity: "local-rates", entityKey: "*", message });
    return { error: message };
  }
}

const derivePartial = (d: DeriveResult | { error: string }) => "error" in d || d.skipped.length > 0;

// ---------------------------------------------------------------- metals-spot

export function metalsSpotJob(env: MarketsEnv, providers: readonly PriceProvider<SpotQuote[]>[] = metalSpotProviders): Job {
  return {
    name: "metals-spot",
    async run(ctx): Promise<JobResult> {
      const now = ctx.now();
      const previous: Partial<Record<Metal, number>> = {};
      for (const s of await latestSpotPerMetal(ctx.db)) {
        if (now.getTime() - s.observedAt.getTime() < 7 * DAY) previous[s.metal as Metal] = s.priceUsdPerOz;
      }
      let rejected: ReturnType<typeof checkSpot>["rejected"] = [];
      const outcome = await firstAvailable(providers, providerContext(ctx, env), (quotes) => {
        const check = requireGold(checkSpot(quotes, previous));
        rejected = check.rejected;
        return check.accepted;
      });
      await reportErrors(ctx, "metal-spot", outcome.errors);
      for (const r of rejected) {
        await ctx.issue({
          severity: "error",
          entity: "metal-spot",
          entityKey: `${r.quote.metal}:${r.quote.source}`,
          message: `rejected: ${r.reason}`,
          details: { price: r.quote.priceUsdPerOz, observedAt: r.quote.observedAt.toISOString() },
        });
      }
      const ticks = await insertSpotTicks(ctx.db, outcome.value);
      const days = new Set(outcome.value.map((q) => isoDay(q.observedAt)));
      for (const d of days) await rollMetalDaily(ctx.db, d);
      const derived = await chainDerive(ctx);
      return {
        done: true,
        cursor: null,
        status: outcome.fallbackUsed || rejected.length > 0 || derivePartial(derived) ? "partial" : "ok",
        stats: {
          provider: outcome.provider,
          fallbackUsed: outcome.fallbackUsed,
          quotes: outcome.value.length,
          ticksInserted: ticks,
          rejected: rejected.length,
          derivedRows: "rows" in derived ? derived.rows : 0,
        },
      };
    },
  };
}

// ---------------------------------------------------------------- fx-daily

type PkrDrop = { quote: PkrQuote; reason: string };

/** Validator for `firstAvailable` that keeps good rows and collects the dropped ones. */
function keepValidPkr(referencePkr: number | undefined, dropped: PkrDrop[]) {
  return (quotes: PkrQuote[]) => {
    const r = checkPkrQuotes(quotes, referencePkr);
    dropped.splice(0, dropped.length, ...r.rejected);
    return r.accepted;
  };
}

async function reportDropped(ctx: JobContext, dataset: string, dropped: PkrDrop[]) {
  for (const d of dropped) {
    await ctx.issue({
      severity: "warn",
      entity: dataset,
      entityKey: `${d.quote.source}:${d.quote.currency}`,
      message: `row dropped: ${d.reason}`,
      details: { buy: d.quote.buy, sell: d.quote.sell, date: d.quote.date },
    });
  }
}

/** Last resort for the interbank row: the reference mid rate, published as buy = sell. */
function referenceAsInterbank(snapshot: FxSnapshot | null): PriceProvider<PkrQuote[]> {
  return {
    id: snapshot?.source ?? "er-api",
    dataset: "pkr-interbank",
    enabled: () => Boolean(snapshot?.rates.PKR),
    async fetch() {
      const pkr = snapshot!.rates.PKR!;
      return [
        { currency: "USD", date: snapshot!.date, kind: "interbank", buy: pkr, sell: pkr, observedAt: snapshot!.observedAt, source: snapshot!.source },
      ];
    },
  };
}

export function fxDailyJob(
  env: MarketsEnv,
  providers: {
    reference?: readonly PriceProvider<FxSnapshot>[];
    interbank?: readonly PriceProvider<PkrQuote[]>[];
  } = {},
): Job {
  return {
    name: "fx-daily",
    async run(ctx): Promise<JobResult> {
      const pctx = providerContext(ctx, env);
      const stats: Record<string, unknown> = {};
      let degraded = false;

      let snapshot: FxSnapshot | null = null;
      try {
        const ref = await firstAvailable(providers.reference ?? fxReferenceProviders, pctx, validateFxSnapshot);
        await reportErrors(ctx, "fx-reference", ref.errors);
        snapshot = ref.value;
        stats.reference = {
          provider: ref.provider,
          date: ref.value.date,
          rows: await upsertFxDaily(ctx.db, { ...ref.value, overwrite: !ref.fallbackUsed }),
        };
        degraded ||= ref.fallbackUsed;
      } catch (error) {
        degraded = true;
        if (error instanceof AllProvidersFailedError) await reportErrors(ctx, "fx-reference", error.errors, "error");
        else throw error;
      }

      let referencePkr = snapshot?.rates.PKR;
      if (!referencePkr) {
        const date = await latestFxDate(ctx.db);
        referencePkr = date ? (await fxOn(ctx.db, date)).find((r) => r.quote === "PKR")?.rateFromUsd : undefined;
      }
      let interbankOk = false;
      try {
        const chain = providers.interbank ?? [sbpWacerProvider, sbpM2mProvider, referenceAsInterbank(snapshot)];
        const dropped: PkrDrop[] = [];
        const ib = await firstAvailable(chain, pctx, keepValidPkr(referencePkr, dropped));
        await reportErrors(ctx, "pkr-interbank", ib.errors);
        await reportDropped(ctx, "pkr-interbank", dropped);
        stats.interbank = { provider: ib.provider, date: ib.value[0]?.date, rows: await upsertPkrQuotes(ctx.db, ib.value, !ib.fallbackUsed) };
        degraded ||= ib.fallbackUsed;
        interbankOk = true;
      } catch (error) {
        degraded = true;
        if (error instanceof AllProvidersFailedError) await reportErrors(ctx, "pkr-interbank", error.errors, "error");
        else throw error;
      }
      if (!snapshot && !interbankOk) throw new Error("fx-daily: no reference and no interbank rates");

      const derived = await chainDerive(ctx);
      stats.derivedRows = "rows" in derived ? derived.rows : 0;
      return { done: true, cursor: null, status: degraded || derivePartial(derived) ? "partial" : "ok", stats };
    },
  };
}

// ---------------------------------------------------------------- pk-market

export function pkMarketJob(
  env: MarketsEnv,
  providers: {
    openMarket?: readonly PriceProvider<PkrQuote[]>[];
    gold?: PriceProvider<ReportedBatch>;
  } = {},
): Job {
  return {
    name: "pk-market",
    async run(ctx): Promise<JobResult> {
      const now = ctx.now();
      const pctx = providerContext(ctx, env);
      const stats: Record<string, unknown> = {};
      let degraded = false;

      const fxDate = await latestFxDate(ctx.db);
      const referencePkr = fxDate ? (await fxOn(ctx.db, fxDate)).find((r) => r.quote === "PKR")?.rateFromUsd : undefined;

      let openOk = false;
      try {
        const dropped: PkrDrop[] = [];
        const om = await firstAvailable(providers.openMarket ?? [forexPkProvider, sbpEcapProvider], pctx, keepValidPkr(referencePkr, dropped));
        await reportErrors(ctx, "pkr-open-market", om.errors);
        await reportDropped(ctx, "pkr-open-market", dropped);
        stats.openMarket = { provider: om.provider, date: om.value[0]?.date, rows: await upsertPkrQuotes(ctx.db, om.value, !om.fallbackUsed) };
        degraded ||= om.fallbackUsed;
        openOk = true;
      } catch (error) {
        degraded = true;
        if (error instanceof AllProvidersFailedError) await reportErrors(ctx, "pkr-open-market", error.errors, "error");
        else throw error;
      }

      let goldOk = false;
      try {
        goldOk = await ingestReportedGold(ctx, pctx, providers.gold ?? appGoldProvider, now, referencePkr, stats);
      } catch (error) {
        await ctx.issue({
          severity: "error",
          entity: "pk-gold-reported",
          entityKey: "app-apsgja",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      degraded ||= !goldOk;
      if (!openOk && !goldOk) throw new Error("pk-market: neither open market nor APSGJA rates could be read");

      const derived = await chainDerive(ctx);
      stats.derivedRows = "rows" in derived ? derived.rows : 0;
      return { done: true, cursor: null, status: degraded || derivePartial(derived) ? "partial" : "ok", stats };
    },
  };
}

/**
 * Stores the APSGJA rates of a story from the last 3 days after checking each one against the
 * spot derived value (more than 5% apart is rejected and raised as an error issue).
 */
async function ingestReportedGold(
  ctx: JobContext,
  pctx: ProviderContext,
  provider: PriceProvider<ReportedBatch>,
  now: Date,
  referencePkr: number | undefined,
  stats: Record<string, unknown>,
): Promise<boolean> {
  const batch = await provider.fetch(pctx);
  const pk = countryByCode("PK")!;
  const today = localDate(now, pk.timeZone);
  if (batch.date < localDate(new Date(now.getTime() - 3 * DAY), pk.timeZone) || batch.date > today) {
    await ctx.issue({ severity: "warn", entity: "pk-gold-reported", entityKey: batch.date, message: `newest APSGJA report is from ${batch.date}`, details: { url: batch.url } });
    stats.gold = { stored: 0, reportDate: batch.date };
    return false;
  }
  const spot: Partial<Record<Metal, number>> = {};
  for (const s of await latestSpotPerMetal(ctx.db)) {
    if (now.getTime() - s.observedAt.getTime() < 4 * DAY) spot[s.metal as Metal] = s.priceUsdPerOz;
  }
  const usd = await pakistanUsdRate(ctx.db, now, referencePkr);
  if (!usd || !spot.XAU) {
    await ctx.issue({ severity: "warn", entity: "pk-gold-reported", entityKey: batch.date, message: "no spot or USD/PKR to cross-check the report; not stored" });
    stats.gold = { stored: 0, reportDate: batch.date };
    return false;
  }
  const accepted = [];
  for (const r of batch.rates) {
    const usdPerOz = spot[r.metal];
    if (!usdPerOz) continue;
    const check = checkReported(r, derivedPrice({ usdPerOunce: usdPerOz, fxLocalPerUsd: usd.rate, metal: r.metal, karat: r.karat, unit: r.unit }));
    if (check.ok) accepted.push(r);
    else {
      await ctx.issue({
        severity: "error",
        entity: "pk-gold-reported",
        entityKey: `${r.metal}:${r.karat}:${r.unit}:${r.date}`,
        message: `reported ${r.price} is ${(check.deviation * 100).toFixed(1)}% from the derived value; rejected`,
        details: { url: batch.url, usdPkr: usd.rate, usdPkrSource: usd.source },
      });
    }
  }
  const stored = await upsertLocalRates(
    ctx.db,
    accepted.map((r) => ({ ...r, kind: "reported" as const })),
  );
  stats.gold = { stored, rejected: batch.rates.length - accepted.length, reportDate: batch.date, url: batch.url };
  return accepted.some((r) => r.metal === "XAU");
}

// ---------------------------------------------------------------- local-rates-derive

export const localRatesDeriveJob: Job = {
  name: "local-rates-derive",
  async run(ctx): Promise<JobResult> {
    const r = await deriveLocalRates(ctx.db, ctx.now());
    for (const s of r.skipped) {
      await ctx.issue({ severity: "warn", entity: "local-rates", entityKey: s.country, message: s.reason });
    }
    if (r.countries.length === 0) throw new Error(`local-rates-derive: nothing derived (${r.skipped.map((s) => s.reason).join("; ")})`);
    return {
      done: true,
      cursor: null,
      status: r.skipped.length ? "partial" : "ok",
      stats: { rows: r.rows, countries: r.countries, pkUsd: r.pkUsd, pkPremiumPct: r.pkPremiumPct },
    };
  },
};

// ---------------------------------------------------------------- housekeeping

export const housekeepingJob: Job = {
  name: "housekeeping",
  async run(ctx): Promise<JobResult> {
    const now = ctx.now();
    // Close yesterday's candle from its ticks before the ticks age out, then prune.
    const rolled = (await rollMetalDaily(ctx.db, isoDay(new Date(now.getTime() - DAY)))) + (await rollMetalDaily(ctx.db, isoDay(now)));
    const ticks = await pruneSpotBefore(ctx.db, new Date(now.getTime() - 30 * DAY));
    const limits = await pruneRateLimitsBefore(ctx.db, new Date(now.getTime() - DAY));
    return { done: true, cursor: null, stats: { dailyRowsRolled: rolled, ticksPruned: ticks, rateLimitRowsPruned: limits } };
  },
};

// ---------------------------------------------------------------- registry

export function readMarketsEnv(source: Record<string, string | undefined> | undefined = globalThis.process?.env): MarketsEnv {
  return {
    METALS_FALLBACK_API_KEY: source?.METALS_FALLBACK_API_KEY || undefined,
    MARKETS_ALLOW_FREEGOLDAPI: source?.MARKETS_ALLOW_FREEGOLDAPI || undefined,
  };
}

export function createMarketJobs(env: MarketsEnv = readMarketsEnv()): Job[] {
  return [metalsSpotJob(env), fxDailyJob(env), pkMarketJob(env), localRatesDeriveJob, housekeepingJob];
}

/**
 * Lane B jobs: `metals-spot`, `fx-daily`, `pk-market`, `local-rates-derive` and `housekeeping`.
 * The web cron dispatcher (apps/web/src/features/markets/jobs.ts) imports this list.
 */
export const marketJobs: Job[] = createMarketJobs();
