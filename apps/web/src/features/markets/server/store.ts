import "server-only";
import { readFileSync } from "node:fs";
import * as q from "@bondcheck/db/queries/markets";
import type { DailyRow, FxRow, LocalRateRecord, PkrRow, SpotRow } from "@bondcheck/db/queries/markets";
import type { Db } from "@bondcheck/db";
import { getDb } from "@/server/db";

/**
 * Read side of the market data. Production reads Postgres through the query module; end to end
 * tests and local development without a database can point `MARKETS_FIXTURE_FILE` at a JSON
 * snapshot of the same tables (pages then show a "sample data" notice).
 */
export interface MarketsStore {
  readonly sample: boolean;
  latestSpot(): Promise<SpotRow[]>;
  previousCloses(date: string): Promise<DailyRow[]>;
  metalDaily(metal: string, fromDate: string | null, toDate?: string | null): Promise<DailyRow[]>;
  latestFxDate(): Promise<string | null>;
  fxOn(date: string): Promise<FxRow[]>;
  fxSeries(quotes: string[], fromDate: string | null, toDate?: string | null): Promise<FxRow[]>;
  pkrLatest(kind?: "interbank" | "open_market"): Promise<PkrRow[]>;
  localRates(country: string, date: string | null): Promise<LocalRateRecord[]>;
  /** Newest reported (not estimated) rows of a country on or after `sinceDate`. */
  latestReported(country: string, sinceDate: string): Promise<LocalRateRecord[]>;
}

export function dbStore(db: Db): MarketsStore {
  return {
    sample: false,
    latestSpot: () => q.latestSpotPerMetal(db),
    previousCloses: (date) => q.previousCloses(db, date),
    metalDaily: (metal, from, to) => q.metalDailySince(db, metal, from, to ?? null),
    latestFxDate: () => q.latestFxDate(db),
    fxOn: (date) => q.fxOn(db, date),
    fxSeries: (quotes, from, to) => q.fxSeries(db, quotes, from, to ?? null),
    pkrLatest: (kind) => q.latestPkrQuotes(db, kind),
    localRates: (country, date) => q.localRatesFor(db, country, date),
    latestReported: (country, since) => q.latestReported(db, country, since),
  };
}

/** Same tables as plain arrays (dates as ISO strings). */
export interface MarketsSnapshot {
  metalSpot: (Omit<SpotRow, "observedAt"> & { observedAt: string })[];
  metalDaily: DailyRow[];
  fxDaily: FxRow[];
  fxPkrMarket: (Omit<PkrRow, "observedAt"> & { observedAt: string })[];
  localRates: (Omit<LocalRateRecord, "observedAt"> & { observedAt: string })[];
}

export function snapshotStore(s: MarketsSnapshot): MarketsStore {
  const spot = s.metalSpot.map((r) => ({ ...r, observedAt: new Date(r.observedAt) }));
  const pkr = s.fxPkrMarket.map((r) => ({ ...r, observedAt: new Date(r.observedAt) }));
  const local = s.localRates.map((r) => ({ ...r, observedAt: new Date(r.observedAt) }));
  const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);
  const newestPer = <T>(rows: T[], key: (r: T) => string, newer: (a: T, b: T) => boolean) => {
    const m = new Map<string, T>();
    for (const r of rows) {
      const k = key(r);
      const cur = m.get(k);
      if (!cur || newer(r, cur)) m.set(k, r);
    }
    return [...m.values()];
  };
  return {
    sample: true,
    latestSpot: async () => newestPer(spot, (r) => r.metal, (a, b) => a.observedAt > b.observedAt),
    previousCloses: async (date) =>
      newestPer(
        s.metalDaily.filter((r) => r.date < date),
        (r) => r.metal,
        (a, b) => a.date > b.date,
      ),
    metalDaily: async (metal, from, to) => s.metalDaily.filter((r) => r.metal === metal && (!from || r.date >= from) && (!to || r.date <= to)).sort(byDate),
    latestFxDate: async () => s.fxDaily.reduce<string | null>((m, r) => (!m || r.date > m ? r.date : m), null),
    fxOn: async (date) => s.fxDaily.filter((r) => r.date === date),
    fxSeries: async (quotes, from, to) => s.fxDaily.filter((r) => quotes.includes(r.quote) && (!from || r.date >= from) && (!to || r.date <= to)).sort(byDate),
    pkrLatest: async (kind) =>
      newestPer(
        pkr.filter((r) => !kind || r.kind === kind),
        (r) => `${r.currency}:${r.kind}`,
        (a, b) => a.date > b.date || (a.date === b.date && a.observedAt > b.observedAt),
      ),
    localRates: async (country, date) => {
      const rows = local.filter((r) => r.country === country);
      const day = date ?? rows.reduce<string | null>((m, r) => (!m || r.date > m ? r.date : m), null);
      return rows.filter((r) => r.date === day);
    },
    latestReported: async (country, since) => {
      const rows = local.filter((r) => r.country === country && r.kind === "reported" && r.date >= since);
      const day = rows.reduce<string | null>((m, r) => (!m || r.date > m ? r.date : m), null);
      return rows.filter((r) => r.date === day);
    },
  };
}

let snapshot: MarketsStore | undefined;

/** Throws when no data source is configured (callers turn that into "unavailable"). */
export function getMarketsStore(): MarketsStore {
  const file = process.env.MARKETS_FIXTURE_FILE;
  if (file) {
    snapshot ??= snapshotStore(JSON.parse(readFileSync(file, "utf8")) as MarketsSnapshot);
    return snapshot;
  }
  return dbStore(getDb());
}
