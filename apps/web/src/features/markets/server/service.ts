import type { z } from "zod";
import type { fxHistory, fxLatest, fxPkr, localRates, metalsHistory, metalsLatest, convert } from "@bondcheck/shared";
import { METALS, type Metal } from "@bondcheck/shared";
import { isFxCurrency } from "@bondcheck/ingest/markets/currencies";
import type { FxRow } from "@bondcheck/db/queries/markets";
import type { MarketsStore } from "./store";

/**
 * Market read logic shared by the JSON API and the pages. Inputs are validated by the contracts;
 * every function returns the contract's `data` plus the source ids behind it (for attribution).
 */
export class MarketsNotFoundError extends Error {}
export class MarketsUnavailableError extends Error {}

export interface Result<T> {
  data: T;
  sources: string[];
}

export type MetalsLatest = z.infer<typeof metalsLatest.response>;
export type MetalsHistory = z.infer<typeof metalsHistory.response>;
export type LocalRates = z.infer<typeof localRates.response>;
export type FxLatest = z.infer<typeof fxLatest.response>;
export type PkrRates = z.infer<typeof fxPkr.response>;
export type FxHistory = z.infer<typeof fxHistory.response>;
export type Conversion = z.infer<typeof convert.response>;
export type Range = "1m" | "6m" | "1y" | "5y" | "max";

const DAY = 86_400_000;
const RANGE_DAYS: Record<Exclude<Range, "max">, number> = { "1m": 31, "6m": 183, "1y": 366, "5y": 5 * 366 };

export function rangeStart(range: Range, today: Date): string | null {
  if (range === "max") return null;
  return new Date(today.getTime() - RANGE_DAYS[range] * DAY).toISOString().slice(0, 10);
}

/** Start and end of a history request: an explicit `from`/`to` wins over the preset range. */
export function historyWindow(args: { range: Range; from?: string; to?: string }, today: Date): { from: string | null; to: string | null } {
  if (args.from || args.to) return { from: args.from ?? null, to: args.to ?? null };
  return { from: rangeStart(args.range, today), to: null };
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
/** Significant precision for prices: 4 decimals below 10, 2 above. */
const price = (n: number) => round(n, Math.abs(n) < 10 ? 6 : 4);

function assertCurrency(code: string): void {
  if (!isFxCurrency(code)) throw new MarketsNotFoundError(`unsupported currency: ${code}`);
}

async function latestFx(store: MarketsStore): Promise<{ date: string; rates: Map<string, number>; sources: Set<string> }> {
  const date = await store.latestFxDate();
  if (!date) throw new MarketsUnavailableError("no exchange rates stored yet");
  const rows = await store.fxOn(date);
  const rates = new Map(rows.map((r) => [r.quote, r.rateFromUsd]));
  rates.set("USD", 1);
  return { date, rates, sources: new Set(rows.map((r) => r.source)) };
}

// ---------------------------------------------------------------- metals

export async function getMetalsLatest(store: MarketsStore, currency: string): Promise<Result<MetalsLatest>> {
  assertCurrency(currency);
  const spot = await store.latestSpot();
  if (spot.length === 0) throw new MarketsUnavailableError("no metal prices stored yet");
  const sources = new Set(spot.map((s) => s.source));
  let rate = 1;
  if (currency !== "USD") {
    const fx = await latestFx(store);
    const r = fx.rates.get(currency);
    if (!r) throw new MarketsNotFoundError(`no rate for ${currency}`);
    rate = r;
    fx.sources.forEach((s) => sources.add(s));
  }
  const newest = spot.reduce((m, s) => (s.observedAt > m ? s.observedAt : m), spot[0]!.observedAt);
  const closes = await store.previousCloses(newest.toISOString().slice(0, 10));
  const data = METALS.flatMap((metal) => {
    const s = spot.find((x) => x.metal === metal);
    if (!s) return [];
    const prev = closes.find((c) => c.metal === metal)?.close;
    return [
      {
        metal,
        currency,
        pricePerOunce: price(s.priceUsdPerOz * rate),
        change24hPct: prev ? round((s.priceUsdPerOz / prev - 1) * 100, 3) : null,
        observedAt: s.observedAt.toISOString(),
        source: s.source,
      },
    ];
  });
  return { data, sources: [...sources] };
}

/** Rate of `quote` per USD on each date, carrying the last known rate over gaps (weekends). */
function carryForward(rows: FxRow[], quote: string): (date: string) => number | undefined {
  const series = rows.filter((r) => r.quote === quote).sort((a, b) => a.date.localeCompare(b.date));
  return (date) => {
    let lo = 0;
    let hi = series.length - 1;
    let found: number | undefined;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (series[mid]!.date <= date) {
        found = series[mid]!.rateFromUsd;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  };
}

export async function getMetalHistory(
  store: MarketsStore,
  args: { metal: Metal; currency: string; range: Range; from?: string; to?: string },
  today = new Date(),
): Promise<Result<MetalsHistory>> {
  assertCurrency(args.currency);
  const { from, to } = historyWindow(args, today);
  const daily = await store.metalDaily(args.metal, from, to);
  const sources = new Set(daily.map((d) => d.source));
  let rateOn: (date: string) => number | undefined = () => 1;
  if (args.currency !== "USD") {
    // Start the FX series a week early so the first points have a rate to carry forward.
    const fxFrom = from ? new Date(Date.parse(from) - 7 * DAY).toISOString().slice(0, 10) : null;
    const fx = await store.fxSeries([args.currency], fxFrom, to);
    fx.forEach((r) => sources.add(r.source));
    rateOn = carryForward(fx, args.currency);
  }
  const points = daily.flatMap((d) => {
    const r = rateOn(d.date);
    if (!r) return [];
    return [{ date: d.date, open: price(d.open * r), high: price(d.high * r), low: price(d.low * r), close: price(d.close * r) }];
  });
  return { data: { metal: args.metal, currency: args.currency, points }, sources: [...sources] };
}

// ---------------------------------------------------------------- local rates

export async function getLocalRates(store: MarketsStore, country: string, date?: string): Promise<Result<LocalRates>> {
  const rows = await store.localRates(country, date ?? null);
  return {
    data: rows.map((r) => ({
      country: r.country,
      city: r.city,
      metal: r.metal as Metal,
      karat: r.karat,
      unit: r.unit as LocalRates[number]["unit"],
      currency: r.currency,
      price: round(r.price, 2),
      kind: r.kind,
      source: r.source,
      date: r.date,
      observedAt: r.observedAt.toISOString(),
    })),
    sources: [...new Set(rows.map((r) => r.source))],
  };
}

// ---------------------------------------------------------------- fx

export async function getFxLatest(store: MarketsStore, base: string): Promise<Result<FxLatest>> {
  assertCurrency(base);
  const fx = await latestFx(store);
  const b = fx.rates.get(base);
  if (!b) throw new MarketsNotFoundError(`no rate for ${base}`);
  const rates: Record<string, number> = {};
  for (const [code, v] of [...fx.rates.entries()].sort(([a], [z]) => a.localeCompare(z))) rates[code] = round(v / b, 10);
  return { data: { base, date: fx.date, rates }, sources: [...fx.sources] };
}

export async function getPkrRates(store: MarketsStore, kind?: "interbank" | "open_market"): Promise<Result<PkrRates>> {
  const rows = await store.pkrLatest(kind);
  const order = (c: string) => (c === "USD" ? "0" : c === "EUR" ? "1" : c === "GBP" ? "2" : c);
  rows.sort((a, b) => order(a.currency).localeCompare(order(b.currency)) || a.kind.localeCompare(b.kind));
  return {
    data: rows.map((r) => ({
      currency: r.currency,
      date: r.date,
      kind: r.kind,
      buy: r.buy,
      sell: r.sell,
      source: r.source,
      observedAt: r.observedAt.toISOString(),
    })),
    sources: [...new Set(rows.map((r) => r.source))],
  };
}

export async function getFxHistory(
  store: MarketsStore,
  args: { base: string; quote: string; range: Range; from?: string; to?: string },
  today = new Date(),
): Promise<Result<FxHistory>> {
  assertCurrency(args.base);
  assertCurrency(args.quote);
  const { from, to } = historyWindow(args, today);
  const codes = [...new Set([args.base, args.quote].filter((c) => c !== "USD"))];
  const rows = await store.fxSeries(codes, from, to);
  const byDate = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, new Map([["USD", 1]]));
    byDate.get(r.date)!.set(r.quote, r.rateFromUsd);
  }
  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, m]) => {
      const b = args.base === "USD" ? 1 : m.get(args.base);
      const q = args.quote === "USD" ? 1 : m.get(args.quote);
      return b && q ? [{ date, rate: round(q / b, 8) }] : [];
    });
  return { data: { base: args.base, quote: args.quote, points }, sources: [...new Set(rows.map((r) => r.source))] };
}

export async function convertAmount(store: MarketsStore, args: { from: string; to: string; amount: number }): Promise<Result<Conversion>> {
  assertCurrency(args.from);
  assertCurrency(args.to);
  const fx = await latestFx(store);
  const f = fx.rates.get(args.from);
  const t = fx.rates.get(args.to);
  if (!f || !t) throw new MarketsNotFoundError(`no rate for ${!f ? args.from : args.to}`);
  const rate = t / f;
  return {
    data: { from: args.from, to: args.to, amount: args.amount, result: round(args.amount * rate, 6), rate: round(rate, 10), asOf: fx.date },
    sources: [...fx.sources],
  };
}
