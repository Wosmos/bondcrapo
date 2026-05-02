import { describe, expect, it } from "vitest";
import { COUNTRIES, countryByCode, countryBySlug, localDate } from "./countries";
import { calibratePremium, derivedPrice, deriveCountryRates, fillFromReported } from "./derive";
import type { ReportedRate } from "./types";
import { checkPkrQuotes, checkReported, checkSpot, validatePkrQuotes } from "./validate";

const within = (actual: number, expected: number, tolerance = 0.0001) =>
  expect(Math.abs(actual / expected - 1)).toBeLessThanOrEqual(tolerance);

describe("derivation math", () => {
  it("24K tola in PKR from spot and the open market dollar, within 0.01%", () => {
    // 4170 USD/oz, 280.25 PKR/USD (forex.pk selling, 2026-10-15), 0.999 fine, 11.6638038 g per tola
    const price = derivedPrice({ usdPerOunce: 4170, fxLocalPerUsd: 280.25, metal: "XAU", karat: 24, unit: "tola" });
    within(price, 437_802.6966);
    // APSGJA published Rs437,836 that day: the formula tracks the Sarafa rate to 0.01%.
    within(price, 437_836, 0.0001);
  });

  it("lower karats use karat / 24, units convert through grams", () => {
    within(derivedPrice({ usdPerOunce: 4170, fxLocalPerUsd: 3.6725, metal: "XAU", karat: 22, unit: "g" }), 451.3364);
    const tola = derivedPrice({ usdPerOunce: 4170, fxLocalPerUsd: 280, metal: "XAU", karat: 24, unit: "tola" });
    const tenG = derivedPrice({ usdPerOunce: 4170, fxLocalPerUsd: 280, metal: "XAU", karat: 24, unit: "10g" });
    within(tola / tenG, 1.16638038);
  });

  it("applies the country premium (India import levy)", () => {
    within(derivedPrice({ usdPerOunce: 4170, fxLocalPerUsd: 88, metal: "XAU", karat: 24, unit: "10g", premiumPct: 6 }), 124_934.1432);
  });

  it("derives every karat and unit a country page lists", () => {
    const pk = countryByCode("PK")!;
    const rows = deriveCountryRates({ config: pk, spotUsd: { XAU: 4170, XAG: 57.5 }, fxLocalPerUsd: 280.25, date: "2026-10-15", observedAt: new Date() });
    expect(rows).toHaveLength(pk.gold.karats.length * pk.gold.units.length + pk.silver.units.length);
    expect(rows.every((r) => r.kind === "derived" && r.source === "derived" && r.currency === "PKR")).toBe(true);
    expect(rows.find((r) => r.metal === "XAG" && r.unit === "tola")!.karat).toBe(0);
    // no silver price, no silver rows
    expect(deriveCountryRates({ config: pk, spotUsd: { XAU: 4170 }, fxLocalPerUsd: 280, date: "2026-10-15", observedAt: new Date() }).some((r) => r.metal === "XAG")).toBe(false);
  });

  it("calibrates the Pakistan premium from the reported rate and clamps outliers", () => {
    expect(calibratePremium({ price: 437_836, unit: "tola" }, 4170, 280.25)).toBeCloseTo(0.008, 3);
    expect(calibratePremium({ price: 600_000, unit: "tola" }, 4170, 280.25)).toBe(6);
    expect(calibratePremium({ price: 300_000, unit: "tola" }, 4170, 280.25)).toBe(-3);
  });

  it("fills 21K, 18K and per gram rates from the reported 24K rate by purity", () => {
    const pk = countryByCode("PK")!;
    const base = { country: "PK", city: "", currency: "PKR", date: "2026-10-15", observedAt: new Date(), source: "app-apsgja" as const };
    const reported: ReportedRate[] = [
      { ...base, metal: "XAU", karat: 24, unit: "tola", price: 437_836 },
      { ...base, metal: "XAU", karat: 24, unit: "10g", price: 375_373 },
      { ...base, metal: "XAU", karat: 22, unit: "10g", price: 344_104 },
      { ...base, metal: "XAG", karat: 0, unit: "tola", price: 6_148 },
    ];
    const filled = fillFromReported(pk, reported);
    const get = (karat: number, unit: string, metal = "XAU") => filled.find((r) => r.metal === metal && r.karat === karat && r.unit === unit);
    expect(get(24, "tola")).toBeUndefined(); // reported, not filled
    expect(get(22, "10g")).toBeUndefined();
    expect(get(21, "tola")!.price).toBeCloseTo((437_836 * 21) / 24, 2);
    expect(get(18, "10g")!.price).toBeCloseTo((375_373 * 18) / 24, 2);
    expect(get(24, "g")!.price).toBeCloseTo(375_373 / 10, 2);
    expect(get(0, "10g", "XAG")!.price).toBeCloseTo((6_148 / 11.6638038) * 10, 2);
    // APSGJA's own 22K 10g figure is the same purity ratio
    expect(344_104 / 375_373).toBeCloseTo(22 / 24, 4);
    expect(filled.every((r) => r.source === "apsgja-purity" && r.kind === "derived")).toBe(true);
  });
});

describe("validation", () => {
  it("rejects a reported value more than 5% from the derived value", () => {
    const r = { price: 437_836 } as ReportedRate;
    expect(checkReported(r, 437_803)).toEqual({ ok: true });
    const off = checkReported({ ...r, price: 437_836 * 1.06 }, 437_803);
    expect(off.ok).toBe(false);
    expect(checkReported({ ...r, price: 437_803 * 0.951 }, 437_803).ok).toBe(true);
    expect(checkReported({ ...r, price: 437_803 * 0.949 }, 437_803).ok).toBe(false);
  });

  it("holds back spot prices outside bounds or jumping more than 15%", () => {
    const at = new Date("2026-10-15T10:00:00Z");
    const c = checkSpot(
      [
        { metal: "XAU", priceUsdPerOz: 4170, observedAt: at, source: "gold-api" },
        { metal: "XAG", priceUsdPerOz: 4170, observedAt: at, source: "gold-api" },
        { metal: "XPT", priceUsdPerOz: 2100, observedAt: at, source: "gold-api" },
      ],
      { XPT: 1630 },
    );
    expect(c.accepted.map((q) => q.metal)).toEqual(["XAU"]);
    expect(c.rejected.map((r) => r.quote.metal)).toEqual(["XAG", "XPT"]);
  });

  it("drops bad rows but keeps the batch while the dollar row is sound", () => {
    const q = { date: "2026-10-15", kind: "open_market" as const, observedAt: new Date(), source: "forex-pk" as const };
    const r = checkPkrQuotes([
      { ...q, currency: "USD", buy: 277.5, sell: 280.25 },
      { ...q, currency: "INR", buy: 2.6, sell: 3.25 },
    ]);
    expect(r.accepted.map((x) => x.currency)).toEqual(["USD"]);
    expect(r.rejected[0]?.reason).toMatch(/spread 25\.0% above 20%/);
  });

  it("checks PKR quotes for spread, ordering and distance from the reference", () => {
    const q = { currency: "USD", date: "2026-10-15", kind: "open_market" as const, observedAt: new Date(), source: "forex-pk" as const };
    expect(validatePkrQuotes([{ ...q, buy: 277.5, sell: 280.25 }], 277)).toHaveLength(1);
    expect(() => validatePkrQuotes([{ ...q, buy: 280, sell: 270 }])).toThrow(/below buying/);
    expect(() => validatePkrQuotes([{ ...q, buy: 277.5, sell: 280.25 }], 200)).toThrow(/10% away/);
    expect(() => validatePkrQuotes([{ ...q, currency: "EUR", buy: 1, sell: 1 }])).toThrow(/no usable USD/);
  });
});

describe("country config", () => {
  it("covers the ten v1 countries with unique slugs and valid zones", () => {
    expect(COUNTRIES.map((c) => c.code)).toEqual(["PK", "AE", "SA", "QA", "KW", "OM", "BH", "GB", "US", "IN"]);
    expect(new Set(COUNTRIES.map((c) => c.slug)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) expect(localDate(new Date("2026-10-15T20:00:00Z"), c.timeZone)).toMatch(/^2026-10-1[56]$/);
    expect(countryBySlug("uae")?.code).toBe("AE");
    expect(countryBySlug("pk")?.code).toBe("PK");
    expect(localDate(new Date("2026-10-15T20:00:00Z"), "Asia/Karachi")).toBe("2026-10-16");
  });
});
