import type { Metal } from "@bondcheck/shared";
import { POPULAR_PKR_PAIRS, isFxCurrency } from "@bondcheck/ingest/markets/currencies";

export const METAL_SLUGS: Record<string, Metal> = { gold: "XAU", silver: "XAG", platinum: "XPT", palladium: "XPD" };
export const SLUG_FOR_METAL: Record<Metal, string> = { XAU: "gold", XAG: "silver", XPT: "platinum", XPD: "palladium" };

export const metalFromSlug = (slug: string): Metal | undefined => METAL_SLUGS[slug.toLowerCase()];

/** `usd-to-pkr` -> { from: "USD", to: "PKR" }; undefined for anything else. */
export function parsePair(slug: string): { from: string; to: string } | undefined {
  const m = /^([a-z]{3})-to-([a-z]{3})$/.exec(slug);
  if (!m) return undefined;
  const from = m[1]!.toUpperCase();
  const to = m[2]!.toUpperCase();
  if (from === to || !isFxCurrency(from) || !isFxCurrency(to)) return undefined;
  return { from, to };
}

export const pairSlug = (from: string, to: string) => `${from.toLowerCase()}-to-${to.toLowerCase()}`;

/** Currencies with a rupee page both ways: the popular ones plus the rest Pakistan's open market quotes. */
export const PKR_PAGE_CURRENCIES: readonly string[] = [...POPULAR_PKR_PAIRS, "DKK", "HKD", "INR", "NOK", "NZD", "SEK", "SGD", "THB"];

const PAGE_SLUGS = new Set(PKR_PAGE_CURRENCIES.flatMap((c) => [pairSlug(c, "PKR"), pairSlug("PKR", c)]));

/** The pair slugs that exist as pages. Any other pair would be a new stored page per URL, so there is none. */
export const pairPageSlugs = (): string[] => [...PAGE_SLUGS];

export const hasPairPage = (from: string, to: string): boolean => PAGE_SLUGS.has(pairSlug(from, to));
