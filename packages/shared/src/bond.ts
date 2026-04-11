const BOND_RE = /^\d{6}$/;

/** Bond numbers are 0..999999 and always rendered left padded to six digits. */
export function formatBondNumber(n: number | string): string {
  const num = typeof n === "string" ? Number.parseInt(n, 10) : n;
  if (!Number.isInteger(num) || num < 0 || num > 999_999) {
    throw new RangeError(`invalid bond number: ${String(n)}`);
  }
  return String(num).padStart(6, "0");
}

export function isBondNumber(value: string): boolean {
  return BOND_RE.test(value);
}

/** Parses a six digit string into its integer form (as stored in `draw_results.bond_number`). */
export function parseBondNumber(value: string): number {
  if (!isBondNumber(value)) throw new RangeError(`invalid bond number: ${value}`);
  return Number.parseInt(value, 10);
}

/** Expands an inclusive range into formatted numbers. Throws if it exceeds `limit`. */
export function expandRange(from: string, to: string, limit: number): string[] {
  const a = parseBondNumber(from);
  const b = parseBondNumber(to);
  if (b < a) throw new RangeError("range end is before range start");
  if (b - a + 1 > limit) throw new RangeError(`range larger than ${limit}`);
  const out: string[] = [];
  for (let i = a; i <= b; i++) out.push(formatBondNumber(i));
  return out;
}
