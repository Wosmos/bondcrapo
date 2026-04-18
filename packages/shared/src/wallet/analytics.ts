/**
 * Personal analytics math for the wallet (PLAN Lane C1). Pure functions so the web API, the
 * mobile app and tests share one implementation.
 */

/** Bond numbers run 000001 to 999999 within a series, and a winning number wins in every series. */
export const NUMBERS_PER_SERIES = 999_999;

export interface MatchLike {
  drawDate: string;
  tier: number;
  amountPkr: number;
}

export interface WinsSummary {
  winsCount: number;
  winningsPkr: number;
  byYear: { year: number; count: number; amountPkr: number }[];
  byTier: { tier: number; count: number; amountPkr: number }[];
}

export function summarizeWins(matches: readonly MatchLike[]): WinsSummary {
  const years = new Map<number, { count: number; amountPkr: number }>();
  const tiers = new Map<number, { count: number; amountPkr: number }>();
  let winningsPkr = 0;
  for (const m of matches) {
    winningsPkr += m.amountPkr;
    const year = Number(m.drawDate.slice(0, 4));
    const y = years.get(year) ?? { count: 0, amountPkr: 0 };
    y.count++;
    y.amountPkr += m.amountPkr;
    years.set(year, y);
    const t = tiers.get(m.tier) ?? { count: 0, amountPkr: 0 };
    t.count++;
    t.amountPkr += m.amountPkr;
    tiers.set(m.tier, t);
  }
  return {
    winsCount: matches.length,
    winningsPkr,
    byYear: [...years].map(([year, v]) => ({ year, ...v })).sort((a, b) => b.year - a.year),
    byTier: [...tiers].map(([tier, v]) => ({ tier, ...v })).sort((a, b) => a.tier - b.tier),
  };
}

export interface PrizeTier {
  tier: number;
  amountPkr: number;
  winnersCount: number;
}

/**
 * Expected prize money per draw for one bond, before withholding tax: the sum over tiers of
 * amount x (winners / numbers per series). This is an estimate, labelled as such in the UI.
 */
export function expectedValuePerBond(prizes: readonly PrizeTier[]): number {
  let ev = 0;
  for (const p of prizes) ev += (p.amountPkr * p.winnersCount) / NUMBERS_PER_SERIES;
  return ev;
}

/** Holdings per denomination times that denomination's latest prize table. Unknown tables count as 0. */
export function expectedValuePerDraw(
  holdings: readonly { denominationCode: string; count: number }[],
  prizeTables: Readonly<Record<string, readonly PrizeTier[]>>,
): number {
  let total = 0;
  for (const h of holdings) total += h.count * expectedValuePerBond(prizeTables[h.denominationCode] ?? []);
  return Math.round(total * 100) / 100;
}

export function faceValueTotal(
  holdings: readonly { denominationCode: string; count: number }[],
  faceValues: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const h of holdings) total += h.count * (faceValues[h.denominationCode] ?? 0);
  return total;
}
