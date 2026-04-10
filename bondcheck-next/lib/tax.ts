// ── Pakistani Prize Bond & Savings Tax Calculator ─────────
// Tax rates effective for Tax Year 2025-2026
// Source: FBR / Income Tax Ordinance 2001

export type FilerStatus = "filer" | "non_filer";

// ── Prize Bond Winnings Tax (Section 156) ─────────────────

const PRIZE_TAX_RATES = {
  filer: 0.15, // 15%
  non_filer: 0.30, // 30%
} as const;

export function calculatePrizeBondTax(
  grossAmount: number,
  filerStatus: FilerStatus
) {
  const taxRate = PRIZE_TAX_RATES[filerStatus];
  const taxAmount = Math.round(grossAmount * taxRate);
  const netAmount = grossAmount - taxAmount;

  return {
    gross_amount: grossAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    net_amount: netAmount,
    filer_status: filerStatus,
  };
}

// ── Savings Certificate Profit Tax (Section 151) ──────────

const SAVINGS_TAX_RATES = {
  filer: 0.15, // 15% WHT on profit
  non_filer: 0.35, // 35% WHT on profit (non-filer higher rate)
} as const;

export function calculateSavingsTax(
  profitAmount: number,
  filerStatus: FilerStatus
) {
  const taxRate = SAVINGS_TAX_RATES[filerStatus];
  const taxAmount = Math.round(profitAmount * taxRate);
  const netProfit = profitAmount - taxAmount;

  return {
    gross_profit: profitAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    net_profit: netProfit,
    filer_status: filerStatus,
  };
}

// ── Savings Certificate Maturity Calculator ───────────────

export function calculateMaturityValue(
  principal: number,
  annualRate: number, // e.g. 11.08 for 11.08%
  years: number,
  compoundingPerYear: number = 1, // 1 = annual, 2 = semi-annual, 12 = monthly
  filerStatus: FilerStatus = "filer"
) {
  const rate = annualRate / 100;
  const n = compoundingPerYear;
  const t = years;

  // Compound interest: A = P(1 + r/n)^(nt)
  const grossValue = principal * Math.pow(1 + rate / n, n * t);
  const grossProfit = grossValue - principal;

  // Apply WHT on profit
  const taxRate = SAVINGS_TAX_RATES[filerStatus];
  const tax = grossProfit * taxRate;
  const netProfit = grossProfit - tax;
  const netValue = principal + netProfit;

  return {
    principal,
    annual_rate: annualRate,
    years,
    gross_value: Math.round(grossValue),
    gross_profit: Math.round(grossProfit),
    tax_rate: taxRate,
    tax_amount: Math.round(tax),
    net_profit: Math.round(netProfit),
    net_value: Math.round(netValue),
    filer_status: filerStatus,
  };
}

// ── Prize Bond Expected Value Calculator ──────────────────

// Prize structure per denomination (per draw, per 1M bond series)
const PRIZE_STRUCTURES: Record<
  number,
  { first: number; second: number; secondCount: number; third: number; thirdCount: number; digital?: boolean }
> = {
  // Bearer bonds (physical)
  100: { first: 700_000, second: 200_000, secondCount: 3, third: 1_000, thirdCount: 1199 },
  200: { first: 750_000, second: 250_000, secondCount: 5, third: 1_250, thirdCount: 2394 },
  750: { first: 1_500_000, second: 500_000, secondCount: 3, third: 9_300, thirdCount: 1696 },
  1500: { first: 3_000_000, second: 1_000_000, secondCount: 3, third: 18_500, thirdCount: 1696 },
  // Premium registered bonds
  25000: { first: 30_000_000, second: 10_000_000, secondCount: 5, third: 300_000, thirdCount: 700 },
  40000: { first: 80_000_000, second: 30_000_000, secondCount: 3, third: 500_000, thirdCount: 660 },
  // Digital registered bonds (launched 2025)
  500: { first: 2_000_000, second: 500_000, secondCount: 3, third: 2_500, thirdCount: 1696, digital: true },
  1000: { first: 4_000_000, second: 1_000_000, secondCount: 3, third: 5_000, thirdCount: 1696, digital: true },
  5000: { first: 20_000_000, second: 5_000_000, secondCount: 3, third: 50_000, thirdCount: 1696, digital: true },
  10000: { first: 40_000_000, second: 10_000_000, secondCount: 3, third: 100_000, thirdCount: 1696, digital: true },
};

export function calculateExpectedValue(
  denomination: number,
  filerStatus: FilerStatus = "filer"
) {
  const structure = PRIZE_STRUCTURES[denomination];
  if (!structure) return null;

  const totalBonds = 1_000_000; // bonds per series
  const drawsPerYear = 4;

  // Total prize money per draw
  const totalPrizes =
    structure.first * 1 +
    structure.second * structure.secondCount +
    structure.third * structure.thirdCount;

  // Total winners per draw
  const totalWinners = 1 + structure.secondCount + structure.thirdCount;

  // Probability of winning per draw
  const winProbPerDraw = totalWinners / totalBonds;
  const winProbPerYear = 1 - Math.pow(1 - winProbPerDraw, drawsPerYear);

  // Expected value per bond per draw (before tax)
  const evPerDraw = totalPrizes / totalBonds;
  const evPerYear = evPerDraw * drawsPerYear;

  // After tax expected value
  const taxRate = PRIZE_TAX_RATES[filerStatus];
  const evPerYearAfterTax = evPerYear * (1 - taxRate);

  // Effective annual return rate
  const effectiveReturn = (evPerYearAfterTax / denomination) * 100;

  return {
    denomination,
    total_prizes_per_draw: totalPrizes,
    total_winners_per_draw: totalWinners,
    win_probability_per_draw: Math.round(winProbPerDraw * 1_000_000) / 1_000_000,
    win_probability_per_year: Math.round(winProbPerYear * 1_000_000) / 1_000_000,
    expected_value_per_draw: Math.round(evPerDraw * 100) / 100,
    expected_value_per_year: Math.round(evPerYear * 100) / 100,
    expected_value_after_tax: Math.round(evPerYearAfterTax * 100) / 100,
    effective_annual_return_percent: Math.round(effectiveReturn * 100) / 100,
    filer_status: filerStatus,
    prize_structure: {
      first: { amount: structure.first, count: 1 },
      second: { amount: structure.second, count: structure.secondCount },
      third: { amount: structure.third, count: structure.thirdCount },
    },
  };
}

/**
 * Compare all denominations side by side.
 */
export function compareAllDenominations(filerStatus: FilerStatus = "filer") {
  return Object.keys(PRIZE_STRUCTURES)
    .map(Number)
    .map((denom) => calculateExpectedValue(denom, filerStatus))
    .filter(Boolean);
}
