import { DENOMINATION_CODES, type DenominationCode } from "@bondcheck/shared";

/**
 * URL slugs for denominations: the bearer codes as they are ("750"), premium bonds spelled out
 * ("premium-40000") so links read well. Shared by pages, links and the sitemap helpers.
 */
export function denominationSlug(code: string): string {
  return code.endsWith("P") ? `premium-${code.slice(0, -1)}` : code;
}

export function codeFromSlug(slug: string): DenominationCode | null {
  const s = decodeURIComponent(slug).toLowerCase();
  const code = s.startsWith("premium-") ? `${s.slice("premium-".length)}P` : s.toUpperCase();
  return (DENOMINATION_CODES as readonly string[]).includes(code) ? (code as DenominationCode) : null;
}

export const isPremium = (code: string) => code.endsWith("P");
export const faceValue = (code: string) => Number.parseInt(code, 10);

/** Order on pages: active bearer bonds, premium bonds, then discontinued bearer bonds. */
export const DISPLAY_ORDER: readonly DenominationCode[] = ["100", "200", "750", "1500", "25000P", "40000P", "7500", "15000", "25000", "40000"];
export const ACTIVE_CODES: readonly DenominationCode[] = ["100", "200", "750", "1500", "25000P", "40000P"];

export const TIER_KEYS = { 1: "first", 2: "second", 3: "third" } as const;
