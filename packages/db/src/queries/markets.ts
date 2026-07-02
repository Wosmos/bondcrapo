import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import type { Db } from "../client";
import { fxDaily, fxPkrMarket, localRates, metalDaily, metalSpot } from "../schema/markets";
import { rateLimits } from "../schema/ops";

/**
 * Market data queries (Lane B). Postgres `numeric` columns come back as strings; every read here
 * converts them to numbers (all market values are far below 2^53 and need at most 10 decimals).
 * Writes take numbers and store fixed decimal strings.
 */

const fixed = (n: number, places: number) => {
  if (!Number.isFinite(n)) throw new RangeError(`not a finite number: ${n}`);
  return n.toFixed(places);
};

// ---------------------------------------------------------------- types

export interface SpotRow {
  metal: string;
  priceUsdPerOz: number;
  observedAt: Date;
  source: string;
}

export interface DailyRow {
  metal: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  source: string;
}

export interface FxRow {
  quote: string;
  date: string;
  rateFromUsd: number;
  source: string;
}

export interface PkrRow {
  currency: string;
  date: string;
  kind: "interbank" | "open_market";
  buy: number;
  sell: number;
  source: string;
  observedAt: Date;
}

export interface LocalRateRecord {
  country: string;
  city: string;
  metal: string;
  karat: number;
  unit: string;
  currency: string;
  price: number;
  kind: "reported" | "derived";
  source: string;
  /** The report this row was read from (reported rows), or null. */
  sourceUrl?: string | null;
  date: string;
  observedAt: Date;
}

// ---------------------------------------------------------------- writes

/** Intraday ticks; a repeated (metal, source, observedAt) is ignored. Returns rows inserted. */
export async function insertSpotTicks(db: Db, rows: SpotRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(metalSpot)
    .values(
      rows.map((r) => ({
        metal: r.metal,
        priceUsdPerOz: fixed(r.priceUsdPerOz, 8),
        observedAt: r.observedAt,
        source: r.source,
      })),
    )
    .onConflictDoNothing()
    .returning({ metal: metalSpot.metal });
  return inserted.length;
}

/**
 * Rolls the ticks of one UTC day into `metal_daily` (open = first tick, close = last tick).
 * Our own ticks win over a backfilled row for the same day.
 */
export async function rollMetalDaily(db: Db, date: string): Promise<number> {
  const start = new Date(`${date}T00:00:00Z`);
  const end = new Date(start.getTime() + 86_400_000);
  const res = await db.execute(sql`
    insert into metal_daily (metal, date, open_usd, high_usd, low_usd, close_usd, source)
    select metal, ${date}::date,
      (array_agg(price_usd_per_oz order by observed_at asc))[1],
      max(price_usd_per_oz),
      min(price_usd_per_oz),
      (array_agg(price_usd_per_oz order by observed_at desc))[1],
      (array_agg(source order by observed_at desc))[1]
    from metal_spot
    where observed_at >= ${start.toISOString()}::timestamptz and observed_at < ${end.toISOString()}::timestamptz
    group by metal
    on conflict (metal, date) do update set
      open_usd = excluded.open_usd, high_usd = excluded.high_usd, low_usd = excluded.low_usd,
      close_usd = excluded.close_usd, source = excluded.source
    returning metal`);
  return rowCount(res);
}

/** Backfilled daily rows. Never overwrites a day we already hold. */
export async function insertMetalDaily(db: Db, rows: DailyRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(metalDaily)
    .values(
      rows.map((r) => ({
        metal: r.metal,
        date: r.date,
        openUsd: fixed(r.open, 8),
        highUsd: fixed(r.high, 8),
        lowUsd: fixed(r.low, 8),
        closeUsd: fixed(r.close, 8),
        source: r.source,
      })),
    )
    .onConflictDoNothing()
    .returning({ metal: metalDaily.metal });
  return inserted.length;
}

/**
 * Reference rates for one day. `overwrite: true` for the primary source (a later publication of
 * the same day replaces it); fallbacks and backfills only fill gaps.
 */
export async function upsertFxDaily(
  db: Db,
  input: { date: string; rates: Record<string, number>; source: string; overwrite: boolean },
): Promise<number> {
  const values = Object.entries(input.rates)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .map(([quote, v]) => ({ quote, date: input.date, rateFromUsd: fixed(v, 10), source: input.source }));
  if (values.length === 0) return 0;
  const q = db.insert(fxDaily).values(values);
  const done = input.overwrite
    ? await q
        .onConflictDoUpdate({
          target: [fxDaily.quote, fxDaily.date],
          set: { rateFromUsd: sql`excluded.rate_from_usd`, source: sql`excluded.source` },
        })
        .returning({ quote: fxDaily.quote })
    : await q.onConflictDoNothing().returning({ quote: fxDaily.quote });
  return done.length;
}

export async function upsertPkrQuotes(db: Db, rows: PkrRow[], overwrite: boolean): Promise<number> {
  if (rows.length === 0) return 0;
  const q = db.insert(fxPkrMarket).values(
    rows.map((r) => ({
      currency: r.currency,
      date: r.date,
      kind: r.kind,
      buy: fixed(r.buy, 6),
      sell: fixed(r.sell, 6),
      source: r.source,
      observedAt: r.observedAt,
    })),
  );
  const done = overwrite
    ? await q
        .onConflictDoUpdate({
          target: [fxPkrMarket.currency, fxPkrMarket.date, fxPkrMarket.kind],
          set: {
            buy: sql`excluded.buy`,
            sell: sql`excluded.sell`,
            source: sql`excluded.source`,
            observedAt: sql`excluded.observed_at`,
          },
        })
        .returning({ c: fxPkrMarket.currency })
    : await q.onConflictDoNothing().returning({ c: fxPkrMarket.currency });
  return done.length;
}

export async function upsertLocalRates(db: Db, rows: LocalRateRecord[]): Promise<number> {
  if (rows.length === 0) return 0;
  const done = await db
    .insert(localRates)
    .values(
      rows.map((r) => ({
        country: r.country,
        city: r.city,
        metal: r.metal,
        karat: r.karat,
        unit: r.unit,
        currency: r.currency,
        price: fixed(r.price, 4),
        kind: r.kind,
        source: r.source,
        sourceUrl: r.sourceUrl ?? null,
        date: r.date,
        observedAt: r.observedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [localRates.country, localRates.city, localRates.metal, localRates.karat, localRates.unit, localRates.date, localRates.kind],
      set: {
        price: sql`excluded.price`,
        currency: sql`excluded.currency`,
        source: sql`excluded.source`,
        sourceUrl: sql`excluded.source_url`,
        observedAt: sql`excluded.observed_at`,
      },
    })
    .returning({ c: localRates.country });
  return done.length;
}

export async function pruneSpotBefore(db: Db, before: Date): Promise<number> {
  return (await db.delete(metalSpot).where(lt(metalSpot.observedAt, before)).returning({ m: metalSpot.metal })).length;
}

export async function pruneRateLimitsBefore(db: Db, before: Date): Promise<number> {
  return (await db.delete(rateLimits).where(lt(rateLimits.windowStart, before)).returning({ k: rateLimits.key })).length;
}

/** Fixed window counter: returns the count after this hit. */
export async function hitRateLimit(db: Db, key: string, windowStart: Date): Promise<number> {
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return row?.count ?? 1;
}

// ---------------------------------------------------------------- reads

/** Newest tick per metal (any source). */
export async function latestSpotPerMetal(db: Db): Promise<SpotRow[]> {
  const rows = await db
    .selectDistinctOn([metalSpot.metal])
    .from(metalSpot)
    .orderBy(metalSpot.metal, desc(metalSpot.observedAt));
  return rows.map((r) => ({ metal: r.metal, priceUsdPerOz: Number(r.priceUsdPerOz), observedAt: r.observedAt, source: r.source }));
}

/** Daily rows of one metal from `fromDate` (inclusive, or everything), oldest first. */
export async function metalDailySince(db: Db, metal: string, fromDate: string | null, toDate: string | null = null): Promise<DailyRow[]> {
  const rows = await db
    .select()
    .from(metalDaily)
    .where(and(eq(metalDaily.metal, metal), fromDate ? gte(metalDaily.date, fromDate) : undefined, toDate ? lte(metalDaily.date, toDate) : undefined))
    .orderBy(asc(metalDaily.date));
  return rows.map(toDaily);
}

/** Latest close of each metal strictly before `date`. */
export async function previousCloses(db: Db, date: string): Promise<DailyRow[]> {
  const rows = await db
    .selectDistinctOn([metalDaily.metal])
    .from(metalDaily)
    .where(lt(metalDaily.date, date))
    .orderBy(metalDaily.metal, desc(metalDaily.date));
  return rows.map(toDaily);
}

export async function latestFxDate(db: Db): Promise<string | null> {
  const [row] = await db.select({ date: fxDaily.date }).from(fxDaily).orderBy(desc(fxDaily.date)).limit(1);
  return row?.date ?? null;
}

export async function fxOn(db: Db, date: string): Promise<FxRow[]> {
  const rows = await db.select().from(fxDaily).where(eq(fxDaily.date, date));
  return rows.map(toFx);
}

/** Daily rates of `quotes` from `fromDate` (inclusive, or everything), oldest first. */
export async function fxSeries(db: Db, quotes: string[], fromDate: string | null, toDate: string | null = null): Promise<FxRow[]> {
  if (quotes.length === 0) return [];
  const rows = await db
    .select()
    .from(fxDaily)
    .where(and(inArray(fxDaily.quote, quotes), fromDate ? gte(fxDaily.date, fromDate) : undefined, toDate ? lte(fxDaily.date, toDate) : undefined))
    .orderBy(asc(fxDaily.date));
  return rows.map(toFx);
}

/** Newest quote per currency and kind. */
export async function latestPkrQuotes(db: Db, kind?: "interbank" | "open_market"): Promise<PkrRow[]> {
  const rows = await db
    .selectDistinctOn([fxPkrMarket.currency, fxPkrMarket.kind])
    .from(fxPkrMarket)
    .where(kind ? eq(fxPkrMarket.kind, kind) : undefined)
    .orderBy(fxPkrMarket.currency, fxPkrMarket.kind, desc(fxPkrMarket.date), desc(fxPkrMarket.observedAt));
  return rows.map(toPkr);
}

/** Rates of one country on `date`, or on the newest date the country has. */
export async function localRatesFor(db: Db, country: string, date: string | null): Promise<LocalRateRecord[]> {
  let day = date;
  if (!day) {
    const [row] = await db
      .select({ date: localRates.date })
      .from(localRates)
      .where(eq(localRates.country, country))
      .orderBy(desc(localRates.date))
      .limit(1);
    day = row?.date ?? null;
  }
  if (!day) return [];
  const rows = await db
    .select()
    .from(localRates)
    .where(and(eq(localRates.country, country), eq(localRates.date, day)))
    .orderBy(asc(localRates.metal), desc(localRates.karat), asc(localRates.unit));
  return rows.map(toLocal);
}

/** Newest reported rows of a country on or after `sinceDate` (all rows of that newest date). */
export async function latestReported(db: Db, country: string, sinceDate: string): Promise<LocalRateRecord[]> {
  const [row] = await db
    .select({ date: localRates.date })
    .from(localRates)
    .where(and(eq(localRates.country, country), eq(localRates.kind, "reported"), gte(localRates.date, sinceDate)))
    .orderBy(desc(localRates.date))
    .limit(1);
  if (!row) return [];
  const rows = await db
    .select()
    .from(localRates)
    .where(and(eq(localRates.country, country), eq(localRates.kind, "reported"), eq(localRates.date, row.date)));
  return rows.map(toLocal);
}

// ---------------------------------------------------------------- mappers

function toDaily(r: typeof metalDaily.$inferSelect): DailyRow {
  return {
    metal: r.metal,
    date: r.date,
    open: Number(r.openUsd),
    high: Number(r.highUsd),
    low: Number(r.lowUsd),
    close: Number(r.closeUsd),
    source: r.source,
  };
}

function toFx(r: typeof fxDaily.$inferSelect): FxRow {
  return { quote: r.quote, date: r.date, rateFromUsd: Number(r.rateFromUsd), source: r.source };
}

function toPkr(r: typeof fxPkrMarket.$inferSelect): PkrRow {
  return {
    currency: r.currency,
    date: r.date,
    kind: r.kind as PkrRow["kind"],
    buy: Number(r.buy),
    sell: Number(r.sell),
    source: r.source,
    observedAt: r.observedAt,
  };
}

function toLocal(r: typeof localRates.$inferSelect): LocalRateRecord {
  return {
    country: r.country,
    city: r.city,
    metal: r.metal,
    karat: r.karat,
    unit: r.unit,
    currency: r.currency,
    price: Number(r.price),
    kind: r.kind as LocalRateRecord["kind"],
    source: r.source,
    sourceUrl: r.sourceUrl,
    date: r.date,
    observedAt: r.observedAt,
  };
}

function rowCount(res: unknown): number {
  if (Array.isArray(res)) return res.length;
  const r = res as { rows?: unknown[]; rowCount?: number | null; affectedRows?: number };
  return r.rows?.length ?? r.rowCount ?? r.affectedRows ?? 0;
}

export interface MarketsFreshness {
  /** Newest intraday metal price per source. */
  spot: { source: string; latest: Date }[];
  /** Newest daily reference exchange rate per source. */
  fx: { source: string; latest: string }[];
  /** Newest Pakistan rupee quote per market (open market, interbank) and source. */
  pkr: { kind: string; source: string; latest: Date }[];
  /** Newest local rate per country, kind and source. */
  local: { country: string; kind: string; source: string; latest: string }[];
}

/** How current each market dataset is, per source, for the data sources page. */
export async function marketsFreshness(db: Db): Promise<MarketsFreshness> {
  const [spot, fx, pkr, local] = await Promise.all([
    db.select({ source: metalSpot.source, latest: sql<Date | string>`max(${metalSpot.observedAt})` }).from(metalSpot).groupBy(metalSpot.source),
    db.select({ source: fxDaily.source, latest: sql<string>`max(${fxDaily.date})` }).from(fxDaily).groupBy(fxDaily.source),
    db
      .select({ kind: fxPkrMarket.kind, source: fxPkrMarket.source, latest: sql<Date | string>`max(${fxPkrMarket.observedAt})` })
      .from(fxPkrMarket)
      .groupBy(fxPkrMarket.kind, fxPkrMarket.source),
    db
      .select({ country: localRates.country, kind: localRates.kind, source: localRates.source, latest: sql<string>`max(${localRates.date})` })
      .from(localRates)
      .groupBy(localRates.country, localRates.kind, localRates.source),
  ]);
  return {
    spot: spot.map((r) => ({ source: r.source, latest: new Date(r.latest) })),
    fx: fx.map((r) => ({ source: r.source, latest: String(r.latest) })),
    pkr: pkr.map((r) => ({ kind: r.kind, source: r.source, latest: new Date(r.latest) })),
    local: local.map((r) => ({ country: r.country, kind: r.kind, source: r.source, latest: String(r.latest) })),
  };
}
