import type { AppLocale } from "@/i18n/types";

const MONTHS: Record<AppLocale, readonly string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ur: ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"],
};

/** Groups digits with commas (Western digits in both locales, matching printed bonds). */
export function groupDigits(value: number, fractionDigits = 0): string {
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [whole = "0", frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/** "Rs 1,500,000" in English, "1,500,000 روپے" in Urdu. */
export function formatPkr(amount: number, locale: AppLocale): string {
  const n = groupDigits(Math.round(amount));
  return locale === "ur" ? `${n} روپے` : `Rs ${n}`;
}

export function formatMoney(amount: number, currency: string, fractionDigits = 2): string {
  return `${currency} ${groupDigits(amount, fractionDigits)}`;
}

/** Formats `YYYY-MM-DD` without relying on the device Intl data (Hermes builds vary). */
export function formatDate(isoDate: string, locale: AppLocale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const month = MONTHS[locale][Number(m[2]) - 1] ?? m[2];
  const day = String(Number(m[3]));
  return locale === "ur" ? `${day} ${month} ${m[1]}` : `${day} ${month} ${m[1]}`;
}

export function formatDateTime(iso: string, locale: AppLocale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = formatDate(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    locale,
  );
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date}, ${time}`;
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Whole days from `today` to `isoDate` (both local calendar dates). */
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const target = Date.UTC(y!, (mo ?? 1) - 1, d ?? 1);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
