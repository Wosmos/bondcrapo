import { z } from "zod";
import { METALS, RATE_COUNTRIES } from "../constants";
import { currencyCodeSchema, isoDateSchema, isoDateTimeSchema } from "./common";
import { defineEndpoint } from "./endpoint";

export const metalSchema = z.enum(METALS);
export const rangeSchema = z.enum(["1m", "6m", "1y", "5y", "max"]);
/** A custom window (`from` and/or `to`, inclusive) overrides `range`. */
const customWindow = { from: isoDateSchema.optional(), to: isoDateSchema.optional() };
const windowInOrder = (q: { from?: string; to?: string }) => !q.from || !q.to || q.from <= q.to;
const WINDOW_ORDER = { message: "to is before from", path: ["to"] };
export const rateKindSchema = z.enum(["reported", "derived"]);
export const weightUnitSchema = z.enum(["tola", "10g", "g", "oz", "kg"]);
export const countrySchema = z.enum(RATE_COUNTRIES);

/** Shown next to every market number (licence terms of the upstream sources). */
export const attributionSchema = z.array(z.object({ name: z.string(), url: z.string().optional(), text: z.string() }));
export const marketsMetaSchema = z.object({
  attribution: attributionSchema.optional(),
  generatedAt: isoDateTimeSchema.optional(),
});

export const metalPriceSchema = z.object({
  metal: metalSchema,
  currency: currencyCodeSchema,
  pricePerOunce: z.number(),
  change24hPct: z.number().nullable(),
  observedAt: isoDateTimeSchema,
  source: z.string(),
});

export const metalsLatest = defineEndpoint({
  id: "markets.metals-latest",
  method: "GET",
  path: "/markets/metals/latest",
  auth: "none",
  query: z.object({ currency: currencyCodeSchema.default("PKR") }),
  response: z.array(metalPriceSchema),
  meta: marketsMetaSchema,
});

export const historyPointSchema = z.object({
  date: isoDateSchema,
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});

export const metalsHistory = defineEndpoint({
  id: "markets.metals-history",
  method: "GET",
  path: "/markets/metals/history",
  auth: "none",
  query: z.object({
    metal: metalSchema,
    currency: currencyCodeSchema.default("USD"),
    range: rangeSchema.default("1m"),
    ...customWindow,
  }).refine(windowInOrder, WINDOW_ORDER),
  response: z.object({
    metal: metalSchema,
    currency: currencyCodeSchema,
    points: z.array(historyPointSchema),
  }),
  meta: marketsMetaSchema,
});

export const localRateSchema = z.object({
  country: z.string().length(2),
  city: z.string(),
  metal: metalSchema,
  karat: z.number().int().min(0).max(24),
  unit: weightUnitSchema,
  currency: currencyCodeSchema,
  price: z.number(),
  kind: rateKindSchema,
  source: z.string(),
  date: isoDateSchema,
  observedAt: isoDateTimeSchema,
});

export const localRates = defineEndpoint({
  id: "markets.local-rates",
  method: "GET",
  path: "/markets/local-rates",
  auth: "none",
  query: z.object({ country: countrySchema.default("PK"), date: isoDateSchema.optional() }),
  response: z.array(localRateSchema),
  meta: marketsMetaSchema,
});

export const fxLatest = defineEndpoint({
  id: "markets.fx-latest",
  method: "GET",
  path: "/markets/fx/latest",
  auth: "none",
  query: z.object({ base: currencyCodeSchema.default("USD") }),
  response: z.object({
    base: currencyCodeSchema,
    date: isoDateSchema,
    rates: z.record(z.string(), z.number()),
  }),
  meta: marketsMetaSchema,
});

export const pkrRateSchema = z.object({
  currency: currencyCodeSchema,
  date: isoDateSchema,
  kind: z.enum(["interbank", "open_market"]),
  buy: z.number(),
  sell: z.number(),
  source: z.string(),
  observedAt: isoDateTimeSchema,
});

export const fxPkr = defineEndpoint({
  id: "markets.fx-pkr",
  method: "GET",
  path: "/markets/fx/pkr",
  auth: "none",
  query: z.object({ kind: z.enum(["open_market", "interbank"]).optional() }),
  response: z.array(pkrRateSchema),
  meta: marketsMetaSchema,
});

export const fxHistory = defineEndpoint({
  id: "markets.fx-history",
  method: "GET",
  path: "/markets/fx/history",
  auth: "none",
  query: z.object({
    base: currencyCodeSchema.default("USD"),
    quote: currencyCodeSchema,
    range: rangeSchema.default("1m"),
    ...customWindow,
  }).refine(windowInOrder, WINDOW_ORDER),
  response: z.object({
    base: currencyCodeSchema,
    quote: currencyCodeSchema,
    points: z.array(z.object({ date: isoDateSchema, rate: z.number() })),
  }),
  meta: marketsMetaSchema,
});

export const convert = defineEndpoint({
  id: "markets.convert",
  method: "GET",
  path: "/markets/convert",
  auth: "none",
  query: z.object({
    from: currencyCodeSchema,
    to: currencyCodeSchema,
    amount: z.coerce.number().positive().max(1e15),
  }),
  response: z.object({
    from: currencyCodeSchema,
    to: currencyCodeSchema,
    amount: z.number(),
    result: z.number(),
    rate: z.number(),
    asOf: isoDateSchema,
  }),
  meta: marketsMetaSchema,
});

export const marketsEndpoints = {
  metalsLatest,
  metalsHistory,
  localRates,
  fxLatest,
  fxPkr,
  fxHistory,
  convert,
} as const;
