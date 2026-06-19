/**
 * Locale aware formatting with Western digits in both locales (ADR 0005): bond numbers, prices
 * and dates match what is printed on bonds and receipts. Safe on server and client.
 */

const INTL: Record<string, string> = { en: "en-PK", ur: "ur-PK-u-nu-latn" };

export const intlLocale = (locale: string): string => INTL[locale] ?? INTL.en;

export function formatNumber(locale: string, value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/** "Rs 1,234" style grouping without a currency symbol; the caller adds "Rs"/"روپے" via messages. */
export function formatAmount(locale: string, value: number, fractionDigits = 0): string {
  return formatNumber(locale, value, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

/** Formats an ISO date (YYYY-MM-DD) or timestamp as a calendar date, read in Pakistan time. */
export function formatDate(locale: string, iso: string, style: "long" | "medium" | "short" = "medium"): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const timeZone = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? "UTC" : "Asia/Karachi";
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: style, timeZone }).format(date);
}
