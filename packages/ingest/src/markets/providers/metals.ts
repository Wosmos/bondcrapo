import { METALS, type Metal } from "@bondcheck/shared";
import { z } from "zod";
import { ParseError, type PriceProvider, type ProviderContext, type SpotQuote } from "../types";

const goldApiPrice = z.object({
  symbol: z.string(),
  price: z.number().positive(),
  currency: z.literal("USD"),
  updatedAt: z.string().datetime({ offset: true }),
});

/** gold-api.com `GET /price/{symbol}`: USD per troy ounce. */
export function parseGoldApiPrice(json: unknown): SpotQuote {
  const r = goldApiPrice.safeParse(json);
  if (!r.success) throw new ParseError("gold-api", `unexpected price payload: ${r.error.issues[0]?.message ?? "invalid"}`);
  if (!(METALS as readonly string[]).includes(r.data.symbol)) throw new ParseError("gold-api", `unknown symbol ${r.data.symbol}`);
  return {
    metal: r.data.symbol as Metal,
    priceUsdPerOz: r.data.price,
    observedAt: new Date(r.data.updatedAt),
    source: "gold-api",
  };
}

export const GOLD_API_BASE = "https://api.gold-api.com";

export const goldApiProvider: PriceProvider<SpotQuote[]> = {
  id: "gold-api",
  dataset: "metal-spot",
  enabled: () => true,
  async fetch({ fetcher }: ProviderContext) {
    const out: SpotQuote[] = [];
    for (const metal of METALS) {
      const res = await fetcher.get(`${GOLD_API_BASE}/price/${metal}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new ParseError("gold-api", `HTTP ${res.status} for ${metal}`);
      out.push(parseGoldApiPrice(JSON.parse(res.body)));
    }
    return out;
  },
};

const metalpriceLatest = z.object({
  success: z.literal(true),
  base: z.literal("USD"),
  timestamp: z.number().int().positive(),
  rates: z.record(z.string(), z.number().positive()),
});

/**
 * MetalpriceAPI `GET /v1/latest?base=USD&currencies=XAU,...`. `rates.XAU` is ounces per USD;
 * `rates.USDXAU` (when present) is the reciprocal, USD per ounce.
 */
export function parseMetalpriceLatest(json: unknown): SpotQuote[] {
  const r = metalpriceLatest.safeParse(json);
  if (!r.success) {
    const info = (json as { error?: { info?: string } } | null)?.error?.info;
    throw new ParseError("metalpriceapi", info ? `API error: ${info}` : "unexpected payload");
  }
  const observedAt = new Date(r.data.timestamp * 1000);
  const out: SpotQuote[] = [];
  for (const metal of METALS) {
    const direct = r.data.rates[`USD${metal}`];
    const inverse = r.data.rates[metal];
    const price = direct ?? (inverse ? 1 / inverse : undefined);
    if (price !== undefined) out.push({ metal, priceUsdPerOz: price, observedAt, source: "metalpriceapi" });
  }
  if (out.length === 0) throw new ParseError("metalpriceapi", "no metal rates in response");
  return out;
}

export const metalpriceProvider: PriceProvider<SpotQuote[]> = {
  id: "metalpriceapi",
  dataset: "metal-spot",
  enabled: ({ env }) => Boolean(env.METALS_FALLBACK_API_KEY),
  async fetch({ fetcher, env }: ProviderContext) {
    // Key goes in a header, never in the URL, so it cannot leak into logs or issues.
    const res = await fetcher.get(`https://api.metalpriceapi.com/v1/latest?base=USD&currencies=${METALS.join(",")}`, {
      headers: { Accept: "application/json", "X-API-KEY": env.METALS_FALLBACK_API_KEY ?? "" },
    });
    if (!res.ok) throw new ParseError("metalpriceapi", `HTTP ${res.status}`);
    return parseMetalpriceLatest(JSON.parse(res.body));
  },
};

/** Primary first. */
export const metalSpotProviders = [goldApiProvider, metalpriceProvider] as const;
