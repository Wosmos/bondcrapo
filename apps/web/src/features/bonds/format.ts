/**
 * Locale aware formatting with Western digits in both locales (bond numbers, prices and dates
 * match printed bonds; PLAN section 8). Safe on server and client.
 */
const intlLocale = (locale: string) => (locale === "ur" ? "ur-PK-u-nu-latn" : "en-PK-u-nu-latn");

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

export function formatNumber(value: number, locale: string): string {
  let f = numberFormats.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
    numberFormats.set(locale, f);
  }
  return f.format(value);
}

/** `2026-07-15` as "15 July 2026" (en) or the Urdu month name with Western digits (ur). */
export function formatDrawDate(iso: string, locale: string, style: "long" | "short" = "long"): string {
  const key = `${locale}|${style}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale(locale), {
      day: "numeric",
      month: style === "long" ? "long" : "short",
      year: "numeric",
      timeZone: "UTC",
    });
    dateFormats.set(key, f);
  }
  return f.format(new Date(`${iso}T00:00:00Z`));
}

export function formatWeekday(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** Today's calendar date in Pakistan (UTC+5, no daylight saving). */
export function todayInPakistan(now = new Date()): string {
  return new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
}

export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
