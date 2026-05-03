import { MAX_CHECK_NUMBERS, formatBondNumber, isBondNumber, type CheckRequest } from "@bondcheck/shared";

export interface BondRange {
  from: string;
  to: string;
}

export interface ParsedBondInput {
  /** Unique single numbers in the order they were typed. */
  numbers: string[];
  ranges: BondRange[];
  /** Tokens that looked like an attempt at a number but are not six digits. */
  invalid: string[];
  /** Numbers the request will expand to (singles plus every number in each range). */
  total: number;
}

const RANGE_RE = /^(\d{6})\s*(?:-|–|to|تا|سے)\s*(\d{6})$/i;
const SEPARATORS = /[\s,;،]+/;

/**
 * Parses what a person types or pastes into the checker: six digit numbers separated by
 * spaces, commas or new lines, and inclusive ranges written as `123400-123450`.
 */
export function parseBondInput(text: string): ParsedBondInput {
  const numbers: string[] = [];
  const seen = new Set<string>();
  const ranges: BondRange[] = [];
  const invalid: string[] = [];

  // Ranges first, so "100000 - 100010" with spaces is not split into two numbers.
  const withoutRanges = text.replace(
    /(\d{6})\s*(?:-|–|\bto\b|تا|سے)\s*(\d{6})/gi,
    (match: string) => {
      const m = RANGE_RE.exec(match.trim());
      if (m) {
        const from = m[1]!;
        const to = m[2]!;
        if (Number(to) >= Number(from)) ranges.push({ from, to });
        else ranges.push({ from: to, to: from });
      }
      return " ";
    },
  );

  for (const raw of withoutRanges.split(SEPARATORS)) {
    const token = raw.trim();
    if (!token) continue;
    if (isBondNumber(token)) {
      if (!seen.has(token)) {
        seen.add(token);
        numbers.push(token);
      }
    } else if (/\d/.test(token)) {
      invalid.push(token);
    }
  }

  const total = numbers.length + ranges.reduce((sum, r) => sum + rangeSize(r), 0);
  return { numbers, ranges, invalid, total };
}

export function rangeSize(r: BondRange): number {
  return Number(r.to) - Number(r.from) + 1;
}

/**
 * Six digit numbers found in lines of recognised text (camera scan). Bond serials are printed
 * as six digits; longer digit runs (phone numbers, dates written without separators) are ignored.
 */
export function extractBondNumbers(lines: readonly string[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    // OCR often reads O as 0 and spaces inside a serial; normalise conservatively.
    const normalised = line.replace(/(?<=\d)[oO](?=\d)/g, "0");
    for (const m of normalised.matchAll(/(?<!\d)(\d{3}\s?\d{3})(?!\d)/g)) {
      const value = m[1]!.replace(/\s/g, "");
      if (isBondNumber(value) && !seen.has(value)) {
        seen.add(value);
        found.push(value);
      }
    }
  }
  return found;
}

export class TooManyNumbersError extends Error {
  constructor(readonly total: number) {
    super(`at most ${MAX_CHECK_NUMBERS} numbers per check`);
    this.name = "TooManyNumbersError";
  }
}

/** Builds the `POST /bonds/check` body. Throws when the input expands past the server limit. */
export function toCheckRequest(input: ParsedBondInput, denomination?: string): CheckRequest {
  if (input.total > MAX_CHECK_NUMBERS) throw new TooManyNumbersError(input.total);
  const base = denomination ? { denomination } : {};
  return {
    items: [
      ...input.numbers.map((number) => ({ ...base, number })),
      ...input.ranges.map((r) => ({ ...base, from: r.from, to: r.to })),
    ],
  };
}

/** Every number of the input, ranges expanded (used when adding to the wallet). */
export function expandInput(input: ParsedBondInput): string[] {
  const out = new Set(input.numbers);
  for (const r of input.ranges) {
    for (let n = Number(r.from); n <= Number(r.to); n++) out.add(formatBondNumber(n));
  }
  return [...out];
}
