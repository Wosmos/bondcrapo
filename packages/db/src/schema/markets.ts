import {
  date,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Intraday ticks, kept 30 days. */
export const metalSpot = pgTable(
  "metal_spot",
  {
    /** 'XAU' | 'XAG' | 'XPT' | 'XPD' */
    metal: text("metal").notNull(),
    priceUsdPerOz: numeric("price_usd_per_oz", { precision: 20, scale: 8 }).notNull(),
    observedAt: ts("observed_at").notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.metal, t.source, t.observedAt] })],
);

/** Permanent history, one row per metal per UTC day. */
export const metalDaily = pgTable(
  "metal_daily",
  {
    metal: text("metal").notNull(),
    date: date("date").notNull(),
    openUsd: numeric("open_usd", { precision: 20, scale: 8 }).notNull(),
    highUsd: numeric("high_usd", { precision: 20, scale: 8 }).notNull(),
    lowUsd: numeric("low_usd", { precision: 20, scale: 8 }).notNull(),
    closeUsd: numeric("close_usd", { precision: 20, scale: 8 }).notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.metal, t.date] })],
);

/** Reference mid rates, base USD. */
export const fxDaily = pgTable(
  "fx_daily",
  {
    quote: text("quote").notNull(),
    date: date("date").notNull(),
    rateFromUsd: numeric("rate_from_usd", { precision: 20, scale: 10 }).notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.quote, t.date] })],
);

/** Pakistan specific: interbank vs open market. */
export const fxPkrMarket = pgTable(
  "fx_pkr_market",
  {
    currency: text("currency").notNull(),
    date: date("date").notNull(),
    /** 'interbank' | 'open_market' */
    kind: text("kind").notNull(),
    buy: numeric("buy", { precision: 20, scale: 6 }).notNull(),
    sell: numeric("sell", { precision: 20, scale: 6 }).notNull(),
    source: text("source").notNull(),
    observedAt: ts("observed_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.currency, t.date, t.kind] })],
);

/** Retail rates per country, reported or derived. */
export const localRates = pgTable(
  "local_rates",
  {
    /** ISO 3166-1 alpha-2 */
    country: text("country").notNull(),
    city: text("city").notNull().default(""),
    metal: text("metal").notNull(),
    /** 0 for silver and platinum */
    karat: smallint("karat").notNull(),
    /** 'tola' | '10g' | 'g' | 'oz' | 'kg' */
    unit: text("unit").notNull(),
    currency: text("currency").notNull(),
    price: numeric("price", { precision: 20, scale: 4 }).notNull(),
    /** 'reported' | 'derived' */
    kind: text("kind").notNull(),
    source: text("source").notNull(),
    /** The exact page or report the figure was read from, when it differs from day to day. */
    sourceUrl: text("source_url"),
    date: date("date").notNull(),
    observedAt: ts("observed_at").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.country, t.city, t.metal, t.karat, t.unit, t.date, t.kind],
    }),
  ],
);
