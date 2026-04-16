import type { Metal } from "@bondcheck/shared";
import type { Fetcher } from "../fetcher";
import type { MarketSourceId } from "./sources";

export interface SpotQuote {
  metal: Metal;
  priceUsdPerOz: number;
  observedAt: Date;
  source: MarketSourceId;
}

/** Reference rates, units of `quote` per 1 USD. */
export interface FxSnapshot {
  /** Calendar day (UTC) the rates are published for. */
  date: string;
  rates: Record<string, number>;
  observedAt: Date;
  source: MarketSourceId;
}

export interface PkrQuote {
  currency: string;
  date: string;
  kind: "interbank" | "open_market";
  buy: number;
  sell: number;
  observedAt: Date;
  source: MarketSourceId;
}

/** A retail rate published by a trade body (Pakistan: APSGJA). */
export interface ReportedRate {
  country: string;
  city: string;
  metal: Metal;
  karat: number;
  unit: "tola" | "10g" | "g" | "oz" | "kg";
  currency: string;
  price: number;
  date: string;
  observedAt: Date;
  source: MarketSourceId;
}

export interface ReportedBatch {
  date: string;
  observedAt: Date;
  url: string;
  rates: ReportedRate[];
  /** International prices quoted in the same report, used only as a cross-check. */
  quotedSpotUsd: Partial<Record<Metal, number>>;
}

export interface ProviderContext {
  fetcher: Fetcher;
  now: Date;
  env: MarketsEnv;
}

export interface MarketsEnv {
  /** MetalpriceAPI key for the metals fallback (optional). */
  METALS_FALLBACK_API_KEY?: string;
  /** Set to "1" once the FreeGoldAPI licence is confirmed for display (owner task). */
  MARKETS_ALLOW_FREEGOLDAPI?: string;
}

export type Dataset = "metal-spot" | "fx-reference" | "pkr-interbank" | "pkr-open-market" | "pk-gold-reported";

/** Common shape of every upstream source. `fetch` throws on transport or parse failure. */
export interface PriceProvider<T> {
  readonly id: MarketSourceId;
  readonly dataset: Dataset;
  /** False when the provider cannot run in this environment (e.g. a missing key). */
  enabled(ctx: ProviderContext): boolean;
  fetch(ctx: ProviderContext): Promise<T>;
}

export class ParseError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(`${source}: ${message}`);
    this.name = "ParseError";
  }
}

export interface ProviderOutcome<T> {
  value: T;
  provider: MarketSourceId;
  /** True when a provider other than the first enabled one answered. */
  fallbackUsed: boolean;
  errors: { provider: MarketSourceId; message: string }[];
}

export class AllProvidersFailedError extends Error {
  constructor(
    readonly dataset: Dataset,
    readonly errors: { provider: MarketSourceId; message: string }[],
  ) {
    super(`${dataset}: every provider failed (${errors.map((e) => `${e.provider}: ${e.message}`).join("; ") || "none enabled"})`);
    this.name = "AllProvidersFailedError";
  }
}

/**
 * Tries providers in order and returns the first value that passes `validate`. A validation
 * failure counts as a provider failure, so bad data never hides behind a successful request.
 */
export async function firstAvailable<T>(
  providers: readonly PriceProvider<T>[],
  ctx: ProviderContext,
  validate: (value: T) => T = (v) => v,
): Promise<ProviderOutcome<T>> {
  const errors: { provider: MarketSourceId; message: string }[] = [];
  const enabled = providers.filter((p) => p.enabled(ctx));
  for (const [i, p] of enabled.entries()) {
    try {
      const value = validate(await p.fetch(ctx));
      return { value, provider: p.id, fallbackUsed: i > 0, errors };
    } catch (error) {
      errors.push({ provider: p.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  throw new AllProvidersFailedError(providers[0]?.dataset ?? "metal-spot", errors);
}
