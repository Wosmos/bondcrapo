import { derivationPurity, priceFromSpot, convertUnitPrice, type Metal, type WeightUnit } from "@bondcheck/shared";
import type { CountryConfig } from "./countries";
import type { MarketSourceId } from "./sources";
import type { ReportedRate } from "./types";

export interface LocalRateRow {
  country: string;
  city: string;
  metal: Metal;
  karat: number;
  unit: WeightUnit;
  currency: string;
  price: number;
  kind: "reported" | "derived";
  source: MarketSourceId;
  date: string;
  observedAt: Date;
}

/** Fine silver is quoted at 0.999 like 24 karat gold; `karat` is stored as 0 for silver. */
const purityFor = (metal: Metal, karat: number) => (metal === "XAU" ? derivationPurity(karat) : 0.999);

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/** Retail estimate: spot (USD/oz) x rate (local per USD) x purity x weight, plus `premiumPct`. */
export function derivedPrice(args: {
  usdPerOunce: number;
  fxLocalPerUsd: number;
  metal: Metal;
  karat: number;
  unit: WeightUnit;
  premiumPct?: number;
}): number {
  const base = priceFromSpot({
    usdPerOunce: args.usdPerOunce,
    fxLocalPerUsd: args.fxLocalPerUsd,
    unit: args.unit,
    purity: purityFor(args.metal, args.karat),
  });
  return base * (1 + (args.premiumPct ?? 0) / 100);
}

export interface DeriveInput {
  config: CountryConfig;
  spotUsd: Partial<Record<Metal, number>>;
  fxLocalPerUsd: number;
  date: string;
  observedAt: Date;
  /** Overrides `config.premiumPct` (Pakistan: calibrated against the reported rate). */
  premiumPct?: number;
}

/** Every karat x unit for gold and every unit for silver that the country page shows. */
export function deriveCountryRates(input: DeriveInput): LocalRateRow[] {
  const { config, spotUsd, fxLocalPerUsd, date, observedAt } = input;
  const premiumPct = input.premiumPct ?? config.premiumPct;
  const rows: LocalRateRow[] = [];
  const push = (metal: Metal, karat: number, unit: WeightUnit) => {
    const usd = spotUsd[metal];
    if (!usd) return;
    rows.push({
      country: config.code,
      city: "",
      metal,
      karat,
      unit,
      currency: config.currency,
      price: round(derivedPrice({ usdPerOunce: usd, fxLocalPerUsd, metal, karat, unit, premiumPct })),
      kind: "derived",
      source: "derived",
      date,
      observedAt,
    });
  };
  for (const karat of config.gold.karats) for (const unit of config.gold.units) push("XAU", karat, unit);
  for (const unit of config.silver.units) push("XAG", 0, unit);
  return rows;
}

/**
 * Premium implied by a reported 24 karat rate over the bare spot value, clamped to a sane band
 * so one bad report cannot drag every estimate (the report itself is checked separately).
 */
export function calibratePremium(reported24: { price: number; unit: WeightUnit }, usdPerOunce: number, fxLocalPerUsd: number): number {
  const bare = derivedPrice({ usdPerOunce, fxLocalPerUsd, metal: "XAU", karat: 24, unit: reported24.unit });
  const pct = (reported24.price / bare - 1) * 100;
  return Math.min(6, Math.max(-3, round(pct, 3)));
}

/**
 * Pakistan: lower karats and missing units are calculated from the reported 24 karat rate by
 * purity (karat / 24), which is how Sarafa markets quote 22K/21K/18K. Reported rows are left
 * as they are; only the gaps are filled.
 */
export function fillFromReported(config: CountryConfig, reported: ReportedRate[]): LocalRateRow[] {
  const out: LocalRateRow[] = [];
  const has = (metal: Metal, karat: number, unit: WeightUnit) =>
    reported.some((r) => r.metal === metal && r.karat === karat && r.unit === unit);
  const base = (metal: Metal, karat: number, unit: WeightUnit) => {
    const same = reported.find((r) => r.metal === metal && r.karat === karat && r.unit === unit);
    if (same) return same.price;
    // Convert from a unit of the same family when possible (per gram from the 10 g figure, not the tola).
    const metric = (u: WeightUnit) => u !== "tola" && u !== "oz";
    const candidates = reported.filter((r) => r.metal === metal && r.karat === karat);
    const any = candidates.find((r) => metric(r.unit) === metric(unit)) ?? candidates[0];
    return any ? convertUnitPrice(any.price, any.unit, unit) : null;
  };
  const sample = reported[0];
  if (!sample) return out;
  for (const karat of config.gold.karats) {
    for (const unit of config.gold.units) {
      if (has("XAU", karat, unit)) continue;
      const p24 = base("XAU", 24, unit);
      if (p24 === null) continue;
      out.push(row("XAU", karat, unit, karat === 24 ? p24 : (p24 * karat) / 24));
    }
  }
  for (const unit of config.silver.units) {
    if (has("XAG", 0, unit)) continue;
    const p = base("XAG", 0, unit);
    if (p !== null) out.push(row("XAG", 0, unit, p));
  }
  return out;

  function row(metal: Metal, karat: number, unit: WeightUnit, price: number): LocalRateRow {
    return {
      country: config.code,
      city: "",
      metal,
      karat,
      unit,
      currency: config.currency,
      price: round(price),
      kind: "derived",
      source: "apsgja-purity",
      date: sample!.date,
      observedAt: sample!.observedAt,
    };
  }
}
