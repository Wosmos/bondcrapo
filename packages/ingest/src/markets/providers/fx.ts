import { METALS, type Metal } from "@bondcheck/shared";
import { z } from "zod";
import { FX_CURRENCIES } from "../currencies";
import { ParseError, type FxSnapshot, type PriceProvider, type ProviderContext } from "../types";

const erApiLatest = z.object({
  result: z.literal("success"),
  base_code: z.literal("USD"),
  time_last_update_unix: z.number().int().positive(),
  rates: z.record(z.string(), z.number()),
});

/** ExchangeRate-API Open Access `GET /v6/latest/USD`. Attribution "Rates By Exchange Rate API" is required. */
export function parseErApiLatest(json: unknown): FxSnapshot {
  const r = erApiLatest.safeParse(json);
  if (!r.success) throw new ParseError("er-api", "unexpected payload");
  const observedAt = new Date(r.data.time_last_update_unix * 1000);
  return {
    date: observedAt.toISOString().slice(0, 10),
    rates: pickCurrencies(r.data.rates, (k) => k),
    observedAt,
    source: "er-api",
  };
}

export const erApiProvider: PriceProvider<FxSnapshot> = {
  id: "er-api",
  dataset: "fx-reference",
  enabled: () => true,
  async fetch({ fetcher }: ProviderContext) {
    const res = await fetcher.get("https://open.er-api.com/v6/latest/USD", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new ParseError("er-api", `HTTP ${res.status}`);
    return parseErApiLatest(JSON.parse(res.body));
  },
};

const currencyApiDay = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usd: z.record(z.string(), z.number()),
});

export interface CurrencyApiDay {
  date: string;
  /** Units per USD for the fiat currencies we support. */
  fx: Record<string, number>;
  /** USD per troy ounce (the file quotes ounces per USD). */
  metals: Partial<Record<Metal, number>>;
}

/** fawazahmed0 currency-api `currencies/usd.json` (latest or a dated release). */
export function parseCurrencyApiDay(json: unknown): CurrencyApiDay {
  const r = currencyApiDay.safeParse(json);
  if (!r.success) throw new ParseError("currency-api", "unexpected payload");
  const metals: Partial<Record<Metal, number>> = {};
  for (const m of METALS) {
    const perUsd = r.data.usd[m.toLowerCase()];
    if (perUsd && perUsd > 0) metals[m] = 1 / perUsd;
  }
  return { date: r.data.date, fx: pickCurrencies(r.data.usd, (k) => k.toLowerCase()), metals };
}

export const currencyApiUrl = (date: "latest" | string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`;

/** Fallback for the daily reference rates. */
export const currencyApiProvider: PriceProvider<FxSnapshot> = {
  id: "currency-api",
  dataset: "fx-reference",
  enabled: () => true,
  async fetch({ fetcher }: ProviderContext) {
    const res = await fetcher.get(currencyApiUrl("latest"), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new ParseError("currency-api", `HTTP ${res.status}`);
    const day = parseCurrencyApiDay(JSON.parse(res.body));
    return { date: day.date, rates: day.fx, observedAt: res.fetchedAt, source: "currency-api" };
  },
};

export const fxReferenceProviders = [erApiProvider, currencyApiProvider] as const;

function pickCurrencies(rates: Record<string, number>, key: (code: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const code of FX_CURRENCIES) {
    const v = rates[key(code)];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[code] = v;
  }
  out.USD = 1;
  return out;
}
