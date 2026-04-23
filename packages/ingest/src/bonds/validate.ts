import type { DenominationCode } from "@bondcheck/shared";
import { SERIES_COUNTS, structureOn } from "./seed";
import type { Candidate, IssueInput, Tier } from "./types";

export interface TierCheck {
  valid: boolean;
  expected: number;
  actual: number;
  reason?: string;
}

export interface CandidateCheck {
  tiers: Partial<Record<Tier, TierCheck>>;
  issues: IssueInput[];
}

/** Winning numbers per series for a tier on a date: the document header, else the reference. */
export function expectedCount(
  code: DenominationCode,
  date: string | null,
  tier: Tier,
  headerCount: number | null | undefined,
): number {
  if (headerCount) return headerCount;
  const s = date ? structureOn(code, date)[tier] : undefined;
  return s?.winnersCount ?? SERIES_COUNTS[code][tier];
}

/**
 * PLAN section 5.1, rules 1 to 3 for one source's view of a draw: six digit numbers in range, no
 * duplicates within a tier, each number in one tier only, and tier counts equal to the counts in
 * the document header or the prize structure for that date (tolerance 0). Rs 200 has five second
 * prizes and Premium 25000 two first prizes, which the reference counts carry.
 */
export function checkCandidate(c: Candidate): CandidateCheck {
  const issues: IssueInput[] = [];
  const tiers: Partial<Record<Tier, TierCheck>> = {};
  const owner = new Map<number, Tier>();
  const crossTier = new Set<number>();
  for (const t of [1, 2, 3] as const) {
    for (const n of c.tiers[t] ?? []) {
      const prev = owner.get(n);
      if (prev !== undefined && prev !== t) crossTier.add(n);
      owner.set(n, t);
    }
  }

  for (const t of [1, 2, 3] as const) {
    const numbers = c.tiers[t];
    if (!numbers) continue;
    const expected = expectedCount(c.denominationCode, c.drawDate, t, c.prizes[t]?.count);
    const reference = SERIES_COUNTS[c.denominationCode][t];
    if (c.prizes[t]?.count && c.prizes[t]?.count !== reference) {
      issues.push({
        severity: "warn",
        message: `tier ${t} header states ${c.prizes[t]?.count} winners, reference is ${reference}`,
      });
    }
    const unique = new Set(numbers);
    let reason: string | undefined;
    if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 999_999)) reason = "number outside 000001 to 999999";
    else if (unique.size !== numbers.length) reason = `${numbers.length - unique.size} duplicate numbers`;
    else if (numbers.some((n) => crossTier.has(n))) reason = "a number appears in more than one tier";
    else if (numbers.length !== expected) reason = `${numbers.length} numbers, expected ${expected}`;
    tiers[t] = { valid: reason === undefined, expected, actual: numbers.length, reason };
  }
  return { tiers, issues };
}
