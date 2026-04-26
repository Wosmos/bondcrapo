import { formatBondNumber } from "../bond";

/**
 * Near misses (PLAN Lane C1): an owned bond of the same denomination that is one digit away
 * from a tier 1 or tier 2 winning number, or shares its last five digits. Shown for interest
 * only; a near miss never pays anything.
 */
export type NearMissReason = "one_digit_off" | "last_five_digits";

export interface OwnedBondRef {
  denominationCode: string;
  /** Integer form, 0..999999 */
  bondNumber: number;
}

export interface WinningNumberRef {
  drawId: number;
  drawDate: string;
  denominationCode: string;
  bondNumber: number;
  tier: number;
}

export interface NearMiss {
  bondNumber: string;
  denominationCode: string;
  drawId: number;
  drawDate: string;
  winningNumber: string;
  tier: number;
  reason: NearMissReason;
}

/**
 * Classifies how close `owned` is to `winning`. Equal numbers are wins, not near misses.
 * Sharing the last five digits is reported first because that is how people compare tickets.
 */
export function classifyNearMiss(owned: number, winning: number): NearMissReason | null {
  if (owned === winning) return null;
  const a = formatBondNumber(owned);
  const b = formatBondNumber(winning);
  if (a.slice(1) === b.slice(1)) return "last_five_digits";
  let diff = 0;
  for (let i = 0; i < 6; i++) if (a[i] !== b[i]) diff++;
  return diff === 1 ? "one_digit_off" : null;
}

/** All 54 numbers that differ from `n` in exactly one of its six digits. */
export function oneDigitNeighbours(n: number): number[] {
  const digits = formatBondNumber(n);
  const out: number[] = [];
  for (let pos = 0; pos < 6; pos++) {
    for (let d = 0; d <= 9; d++) {
      if (String(d) === digits[pos]) continue;
      out.push(Number(digits.slice(0, pos) + d + digits.slice(pos + 1)));
    }
  }
  return out;
}

export interface FindNearMissesOptions {
  /** Tiers considered (default 1 and 2: the prizes worth talking about). */
  tiers?: readonly number[];
  /** Most recent first, capped (default 50). */
  limit?: number;
}

/**
 * O(winners x 54) using a set of owned numbers per denomination, so a wallet with thousands of
 * bonds checked against every tier 1 and 2 number since 2000 stays in the low milliseconds.
 */
export function findNearMisses(
  owned: readonly OwnedBondRef[],
  winners: readonly WinningNumberRef[],
  options: FindNearMissesOptions = {},
): NearMiss[] {
  const tiers = new Set(options.tiers ?? [1, 2]);
  const limit = options.limit ?? 50;
  const byDenomination = new Map<string, Set<number>>();
  for (const b of owned) {
    let set = byDenomination.get(b.denominationCode);
    if (!set) byDenomination.set(b.denominationCode, (set = new Set()));
    set.add(b.bondNumber);
  }

  const out: NearMiss[] = [];
  for (const w of winners) {
    if (!tiers.has(w.tier)) continue;
    const mine = byDenomination.get(w.denominationCode);
    if (!mine) continue;
    for (const candidate of oneDigitNeighbours(w.bondNumber)) {
      if (!mine.has(candidate)) continue;
      const reason = classifyNearMiss(candidate, w.bondNumber);
      if (!reason) continue;
      out.push({
        bondNumber: formatBondNumber(candidate),
        denominationCode: w.denominationCode,
        drawId: w.drawId,
        drawDate: w.drawDate,
        winningNumber: formatBondNumber(w.bondNumber),
        tier: w.tier,
        reason,
      });
    }
  }
  out.sort(
    (x, y) =>
      y.drawDate.localeCompare(x.drawDate) || x.tier - y.tier || x.bondNumber.localeCompare(y.bondNumber),
  );
  return out.slice(0, limit);
}
