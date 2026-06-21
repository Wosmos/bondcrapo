import type { Metal } from "@bondcheck/shared";
import type { FxSnapshot, PkrQuote, ReportedRate, SpotQuote } from "./types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Plausible USD per troy ounce. Far outside any price seen this century, tight enough to catch unit mix-ups. */
export const SPOT_BOUNDS: Record<Metal, [number, number]> = {
  XAU: [200, 50_000],
  XAG: [2, 2_000],
  XPT: [100, 20_000],
  XPD: [100, 20_000],
};

/** A tick that moved more than this against the last stored price is held back as an issue. */
export const MAX_SPOT_JUMP = 0.15;

export interface SpotCheck {
  accepted: SpotQuote[];
  rejected: { quote: SpotQuote; reason: string }[];
}

export function checkSpot(quotes: SpotQuote[], previous: Partial<Record<Metal, number>> = {}): SpotCheck {
  const accepted: SpotQuote[] = [];
  const rejected: SpotCheck["rejected"] = [];
  for (const q of quotes) {
    const [lo, hi] = SPOT_BOUNDS[q.metal];
    const prev = previous[q.metal];
    if (!Number.isFinite(q.priceUsdPerOz) || q.priceUsdPerOz < lo || q.priceUsdPerOz > hi) {
      rejected.push({ quote: q, reason: `price ${q.priceUsdPerOz} outside ${lo}..${hi}` });
    } else if (Number.isNaN(q.observedAt.getTime())) {
      rejected.push({ quote: q, reason: "invalid timestamp" });
    } else if (prev && Math.abs(q.priceUsdPerOz / prev - 1) > MAX_SPOT_JUMP) {
      rejected.push({ quote: q, reason: `moved ${((q.priceUsdPerOz / prev - 1) * 100).toFixed(1)}% from ${prev}` });
    } else accepted.push(q);
  }
  return { accepted, rejected };
}

/** Throws unless gold is present and valid: a spot run without gold is a failed run. */
export function requireGold(check: SpotCheck): SpotCheck {
  if (!check.accepted.some((q) => q.metal === "XAU")) {
    throw new ValidationError(`no valid gold price (${check.rejected.map((r) => `${r.quote.metal}: ${r.reason}`).join("; ") || "missing"})`);
  }
  return check;
}

const REQUIRED_FX = ["PKR", "EUR", "GBP", "AED", "SAR", "INR"] as const;

export function validateFxSnapshot(s: FxSnapshot): FxSnapshot {
  for (const code of REQUIRED_FX) {
    if (!(s.rates[code]! > 0)) throw new ValidationError(`${s.source}: missing ${code}`);
  }
  const pkr = s.rates.PKR!;
  if (pkr < 50 || pkr > 2000) throw new ValidationError(`${s.source}: implausible USD/PKR ${pkr}`);
  if (Object.keys(s.rates).length < 100) throw new ValidationError(`${s.source}: only ${Object.keys(s.rates).length} currencies`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) throw new ValidationError(`${s.source}: bad date ${s.date}`);
  return s;
}

/**
 * PKR quotes: positive, selling not below buying (allowing rounding) and a spread under 20%
 * (small value currencies such as INR are quoted to 0.05 rupee, so their spread looks wide).
 * A bad row is dropped and reported; the batch fails only when the dollar row is unusable or
 * more than 10% away from the reference rate.
 */
export function checkPkrQuotes(quotes: PkrQuote[], referenceUsdPkr?: number): { accepted: PkrQuote[]; rejected: { quote: PkrQuote; reason: string }[] } {
  const accepted: PkrQuote[] = [];
  const rejected: { quote: PkrQuote; reason: string }[] = [];
  for (const q of quotes) {
    const reason =
      !(q.buy > 0 && q.sell > 0) || !Number.isFinite(q.buy) || !Number.isFinite(q.sell)
        ? "non positive rate"
        : q.sell < q.buy * 0.995
          ? `selling ${q.sell} below buying ${q.buy}`
          : q.sell / q.buy - 1 > 0.2
            ? `spread ${((q.sell / q.buy - 1) * 100).toFixed(1)}% above 20%`
            : null;
    if (reason) rejected.push({ quote: q, reason });
    else accepted.push(q);
  }
  const usd = accepted.find((q) => q.currency === "USD");
  if (!usd) {
    const why = rejected.find((r) => r.quote.currency === "USD")?.reason ?? "missing";
    throw new ValidationError(`no usable USD quote (${why})`);
  }
  if (referenceUsdPkr) {
    const mid = (usd.buy + usd.sell) / 2;
    if (Math.abs(mid / referenceUsdPkr - 1) > 0.1) {
      throw new ValidationError(`${usd.source}: USD ${mid} more than 10% away from reference ${referenceUsdPkr}`);
    }
  }
  return { accepted, rejected };
}

/** Throwing form of `checkPkrQuotes` that keeps only the accepted rows. */
export function validatePkrQuotes(quotes: PkrQuote[], referenceUsdPkr?: number): PkrQuote[] {
  return checkPkrQuotes(quotes, referenceUsdPkr).accepted;
}

/** Reported retail rates more than this away from the spot derived value are rejected (PLAN 4.2). */
export const REPORTED_TOLERANCE = 0.05;

export function checkReported(
  reported: ReportedRate,
  derivedPrice: number,
): { ok: true } | { ok: false; deviation: number } {
  const deviation = reported.price / derivedPrice - 1;
  return Math.abs(deviation) <= REPORTED_TOLERANCE ? { ok: true } : { ok: false, deviation };
}
