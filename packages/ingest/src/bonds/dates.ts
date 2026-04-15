const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** Builds an ISO date, rejecting impossible calendar dates (31 February and friends). */
export function isoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthNumber(name: string): number | null {
  return MONTHS[name.slice(0, 3).toLowerCase()] ?? null;
}

function fullYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

/**
 * Normalises every date spelling found in the sources into `YYYY-MM-DD`:
 * `15-Oct-2002` and `1 August 2017` (legacy snapshot), `15-01-2026` and `15/01/2019` (official
 * day first), `17.02.2025`, `15 October, 2026` (official date list), `15th December, 2023`,
 * `February 15, 2024` and `11th MAR, 2019`. Numeric dates are always read day first, as every
 * Pakistani source writes them.
 */
export function parseLooseDate(input: string): string | null {
  const s = input.replace(/\s+/g, " ").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/.exec(s);
  if (m) return isoDate(fullYear(m[3]!), Number(m[2]), Number(m[1]));
  m = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?[-\\s]+${MONTH_RE}\\.?,?[-\\s]+(\\d{4})$`, "i").exec(s);
  if (m) {
    const month = monthNumber(m[2]!);
    return month ? isoDate(Number(m[3]), month, Number(m[1])) : null;
  }
  m = new RegExp(`^${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})$`, "i").exec(s);
  if (m) {
    const month = monthNumber(m[1]!);
    return month ? isoDate(Number(m[3]), month, Number(m[2])) : null;
  }
  return null;
}

/** Finds the first date in free text, using the same spellings as `parseLooseDate`. */
export function findDate(text: string): string | null {
  const patterns = [
    /(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/,
    new RegExp(`(\\d{1,2}(?:st|nd|rd|th)?[-\\s]+${MONTH_RE}\\.?,?[-\\s]+\\d{4})`, "i"),
    new RegExp(`(${MONTH_RE}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const iso = parseLooseDate(m[1]!);
      if (iso) return iso;
    }
  }
  return null;
}

export function toEpochDay(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(toEpochDay(a) - toEpochDay(b));
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Pakistan Standard Time calendar date (UTC+5, no daylight saving). */
export function pktDate(now: Date): string {
  return new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
}
