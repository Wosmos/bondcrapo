import "server-only";
import { unstable_cache } from "next/cache";
import type { Metal } from "@bondcheck/shared";
import { MARKETS_TAG } from "@/platform/revalidate";
import {
  getFxHistory,
  getFxLatest,
  getLocalRates,
  getLatestReported,
  getMetalHistory,
  getMetalsLatest,
  getPkrRates,
  type Range,
  type Result,
} from "./service";
import { getMarketsStore, type MarketsStore } from "./store";

/** Market pages revalidate every 15 minutes and on the `markets` tag after each ingest. */
export const MARKETS_REVALIDATE_SECONDS = 900;

export type Loaded<T> = ({ ok: true; sample: boolean } & Result<T>) | { ok: false };

/**
 * Loads page data through the Next data cache. Failures (no database at build time, an outage)
 * become `{ ok: false }` and are not cached, so pages render an "unavailable" state and recover
 * on the next revalidation.
 */
async function load<T>(key: string[], fn: (store: MarketsStore) => Promise<Result<T>>): Promise<Loaded<T>> {
  let store: MarketsStore;
  try {
    store = getMarketsStore();
  } catch {
    return { ok: false };
  }
  try {
    if (store.sample) return { ok: true, sample: true, ...(await fn(store)) };
    const cached = unstable_cache(() => fn(store), ["markets", ...key], { tags: [MARKETS_TAG], revalidate: MARKETS_REVALIDATE_SECONDS });
    return { ok: true, sample: false, ...(await cached()) };
  } catch (error) {
    console.warn(`[markets] ${key.join(":")} unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false };
  }
}

export const loadMetalsLatest = (currency: string) => load(["metals-latest", currency], (s) => getMetalsLatest(s, currency));

export const loadMetalHistory = (metal: Metal, currency: string, range: Range) =>
  load(["metal-history", metal, currency, range], (s) => getMetalHistory(s, { metal, currency, range }));

export const loadLocalRates = (country: string) => load(["local-rates", country], (s) => getLocalRates(s, country));

export const loadLatestReported = (country: string) => load(["latest-reported", country], (s) => getLatestReported(s, country));

export const loadFxLatest = (base: string) => load(["fx-latest", base], (s) => getFxLatest(s, base));

export const loadPkrRates = () => load(["fx-pkr"], (s) => getPkrRates(s));

export const loadFxHistory = (base: string, quote: string, range: Range) =>
  load(["fx-history", base, quote, range], (s) => getFxHistory(s, { base, quote, range }));
