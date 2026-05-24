/**
 * Number and date formatting for market pages, shared by server and client components.
 * Prices use Western digits in both locales (PLAN section 8) and the locale's grouping.
 */
export type MarketsLocale = "en" | "ur";

const tag = (locale: string) => (locale === "ur" ? "ur-PK-u-nu-latn" : "en-PK");

const cache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag(locale), { numberingSystem: "latn", ...opts });
    cache.set(key, f);
  }
  return f;
}

/** Sensible decimals: large rupee amounts are whole, small rates keep four decimals. */
export function decimalsFor(value: number): number {
  const v = Math.abs(value);
  if (v >= 1000) return 0;
  if (v >= 100) return 2;
  if (v >= 1) return 2;
  return 4;
}

/** "Rs 437,836" / "AED 504.12" (ISO code, never an ambiguous symbol like $ in a PKR context). */
export function formatMoney(locale: string, currency: string, value: number, decimals = decimalsFor(value)): string {
  return nf(locale, {
    style: "currency",
    currency,
    currencyDisplay: currency === "PKR" ? "symbol" : "code",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(locale: string, value: number, decimals = decimalsFor(value)): string {
  return nf(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export function formatPercent(locale: string, pct: number, digits = 2): string {
  return nf(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: "exceptZero" }).format(pct / 100);
}

export function formatDate(locale: string, isoDate: string, style: "long" | "medium" | "short" = "medium"): string {
  const d = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00Z` : isoDate);
  const opts: Intl.DateTimeFormatOptions =
    style === "long"
      ? { day: "numeric", month: "long", year: "numeric" }
      : style === "medium"
        ? { day: "numeric", month: "short", year: "numeric" }
        : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(tag(locale), { ...opts, numberingSystem: "latn", timeZone: "UTC" }).format(d);
}

/** Date and time in Pakistan time, e.g. "15 Oct 2026, 7:00 pm". */
export function formatDateTime(locale: string, iso: string, timeZone = "Asia/Karachi"): string {
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    numberingSystem: "latn",
  }).format(new Date(iso));
}

export function direction(pct: number | null | undefined): "up" | "down" | "flat" {
  if (pct === null || pct === undefined || Math.abs(pct) < 0.005) return "flat";
  return pct > 0 ? "up" : "down";
}

/** True when `iso` is more than `days` old at render time (ISR pages re-render every 15 minutes). */
export function isOlderThanDays(iso: string, days: number, now: number = Date.now()): boolean {
  return now - new Date(iso).getTime() > days * 86_400_000;
}
