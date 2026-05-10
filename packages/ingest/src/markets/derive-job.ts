import {
  fxOn,
  latestFxDate,
  latestPkrQuotes,
  latestReported,
  latestSpotPerMetal,
  upsertLocalRates,
  type LocalRateRecord,
} from "@bondcheck/db/queries/markets";
import type { Db } from "@bondcheck/db";
import type { Metal, WeightUnit } from "@bondcheck/shared";
import { COUNTRIES, localDate, type CountryConfig } from "./countries";
import { calibratePremium, deriveCountryRates, fillFromReported, type LocalRateRow } from "./derive";
import type { ReportedRate } from "./types";

const DAY = 86_400_000;
/** Inputs older than this are not used for an estimate shown as today's. */
export const MAX_INPUT_AGE_DAYS = 4;

export interface DeriveResult {
  rows: number;
  countries: string[];
  skipped: { country: string; reason: string }[];
  /** Pakistan rupees per USD used for Pakistan, and where it came from. */
  pkUsd?: { rate: number; source: string };
  pkPremiumPct?: number;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Rupees per dollar for Pakistan: open market selling, else interbank selling, else reference mid. */
export async function pakistanUsdRate(db: Db, now: Date, referencePkr?: number): Promise<{ rate: number; source: string } | null> {
  const since = isoDay(new Date(now.getTime() - MAX_INPUT_AGE_DAYS * DAY));
  const quotes = await latestPkrQuotes(db);
  for (const kind of ["open_market", "interbank"] as const) {
    const q = quotes.find((x) => x.currency === "USD" && x.kind === kind && x.date >= since);
    if (q) return { rate: q.sell, source: q.source };
  }
  return referencePkr ? { rate: referencePkr, source: "reference" } : null;
}

/**
 * `local-rates-derive`: estimates for every country from the newest spot and exchange rates,
 * plus the Pakistan purity fill from the APSGJA report. Chained after metals-spot, fx-daily
 * and pk-market, and runnable on its own.
 */
export async function deriveLocalRates(db: Db, now: Date): Promise<DeriveResult> {
  const result: DeriveResult = { rows: 0, countries: [], skipped: [] };
  const oldest = now.getTime() - MAX_INPUT_AGE_DAYS * DAY;

  const spot: Partial<Record<Metal, number>> = {};
  let spotAt = 0;
  for (const s of await latestSpotPerMetal(db)) {
    if (s.observedAt.getTime() < oldest) continue;
    spot[s.metal as Metal] = s.priceUsdPerOz;
    spotAt = Math.max(spotAt, s.observedAt.getTime());
  }
  if (!spot.XAU) {
    result.skipped.push({ country: "*", reason: "no gold spot price from the last days" });
    return result;
  }

  const fxDate = await latestFxDate(db);
  const fx = new Map<string, number>();
  if (fxDate && new Date(`${fxDate}T23:59:59Z`).getTime() >= oldest) {
    for (const r of await fxOn(db, fxDate)) fx.set(r.quote, r.rateFromUsd);
  }
  fx.set("USD", 1);

  const pk = await pakistanUsdRate(db, now, fx.get("PKR"));
  if (pk) result.pkUsd = pk;

  const observedAt = new Date(spotAt);
  const rows: LocalRateRow[] = [];
  for (const config of COUNTRIES) {
    const rate = config.fx === "pk-open-market" ? pk?.rate : fx.get(config.currency);
    if (!rate) {
      result.skipped.push({ country: config.code, reason: `no ${config.currency} rate` });
      continue;
    }
    const date = localDate(now, config.timeZone);
    if (config.code === "PK") {
      const pkRows = await pakistanRows(db, config, spot, rate, date, observedAt, now);
      rows.push(...pkRows.rows);
      result.pkPremiumPct = pkRows.premiumPct;
    } else {
      rows.push(...deriveCountryRates({ config, spotUsd: spot, fxLocalPerUsd: rate, date, observedAt }));
    }
    result.countries.push(config.code);
  }
  result.rows = await upsertLocalRates(db, rows as LocalRateRecord[]);
  return result;
}

async function pakistanRows(
  db: Db,
  config: CountryConfig,
  spot: Partial<Record<Metal, number>>,
  rate: number,
  date: string,
  observedAt: Date,
  now: Date,
): Promise<{ rows: LocalRateRow[]; premiumPct: number }> {
  const since = isoDay(new Date(now.getTime() - 3 * DAY));
  const reported = (await latestReported(db, "PK", since)).map(
    (r): ReportedRate => ({ ...r, metal: r.metal as Metal, unit: r.unit as WeightUnit, source: "app-apsgja" }),
  );
  const tola24 = reported.find((r) => r.metal === "XAU" && r.karat === 24 && r.unit === "tola");

  if (tola24 && reported[0]!.date === date) {
    // Today's report exists: gaps are filled by purity; reported combinations also get the bare
    // international parity value (premium 0) so the page can show the local premium.
    const parity = deriveCountryRates({ config, spotUsd: spot, fxLocalPerUsd: rate, date, observedAt, premiumPct: 0 }).filter((d) =>
      reported.some((r) => r.metal === d.metal && r.karat === d.karat && r.unit === d.unit),
    );
    const premiumPct = calibratePremium(tola24, spot.XAU!, rate);
    return { rows: [...fillFromReported(config, reported), ...parity], premiumPct };
  }
  const premiumPct = tola24 ? calibratePremium(tola24, spot.XAU!, rate) : config.premiumPct;
  return { rows: deriveCountryRates({ config, spotUsd: spot, fxLocalPerUsd: rate, date, observedAt, premiumPct }), premiumPct };
}
