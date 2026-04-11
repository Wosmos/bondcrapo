/** Grams per troy ounce. */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;
/** Grams per tola (South Asian unit). */
export const GRAMS_PER_TOLA = 11.6638038;

export type WeightUnit = "tola" | "10g" | "g" | "oz" | "kg";

const GRAMS_PER_UNIT: Record<WeightUnit, number> = {
  tola: GRAMS_PER_TOLA,
  "10g": 10,
  g: 1,
  oz: GRAMS_PER_TROY_OUNCE,
  kg: 1000,
};

export function gramsPerUnit(unit: WeightUnit): number {
  return GRAMS_PER_UNIT[unit];
}

/** Fineness used when deriving from spot: 24K bullion is 0.999 pure. */
export const BULLION_PURITY = 0.999;

/** Display fraction of a karat (24K = 24/24). */
export function karatFraction(karat: number): number {
  if (karat < 1 || karat > 24) throw new RangeError(`invalid karat: ${karat}`);
  return karat / 24;
}

/**
 * Purity used when deriving a retail price from spot: 24K uses bullion fineness (0.999),
 * lower karats use karat / 24.
 */
export function derivationPurity(karat: number): number {
  return karat === 24 ? BULLION_PURITY : karatFraction(karat);
}

/** Price of one `unit` of metal at `purity`, from USD per troy ounce and a USD to local rate. */
export function priceFromSpot(args: {
  usdPerOunce: number;
  fxLocalPerUsd: number;
  unit: WeightUnit;
  purity: number;
}): number {
  const perGramUsd = args.usdPerOunce / GRAMS_PER_TROY_OUNCE;
  return perGramUsd * args.fxLocalPerUsd * args.purity * gramsPerUnit(args.unit);
}

/** Converts a price per `from` unit into a price per `to` unit. */
export function convertUnitPrice(price: number, from: WeightUnit, to: WeightUnit): number {
  return (price / gramsPerUnit(from)) * gramsPerUnit(to);
}
