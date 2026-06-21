import type { WeightUnit } from "@bondcheck/shared";

export type RateCountry = "PK" | "AE" | "SA" | "QA" | "KW" | "OM" | "BH" | "GB" | "US" | "IN";

export interface CountryConfig {
  code: RateCountry;
  /** URL segment for /gold-rate/[country]. */
  slug: string;
  currency: string;
  /** Local calendar day of a rate is taken in this zone. */
  timeZone: string;
  gold: { karats: number[]; units: WeightUnit[] };
  silver: { units: WeightUnit[] };
  /** Unit shown first on the country page. */
  primaryUnit: WeightUnit;
  /**
   * Added on top of the bullion value for the estimate, in percent. Only charges that apply to
   * every retail quote belong here (import duty); making charges and VAT vary by shop and are
   * excluded and said so on the page. Review against a reported source before changing.
   */
  premiumPct: number;
  premiumNote?: string;
  /**
   * Pakistan prices follow the open market dollar (what Sarafa markets pay), everywhere else
   * the reference mid rate is used.
   */
  fx: "pk-open-market" | "reference";
  /** Cities offered by the city selector (the published rate is national). */
  cities?: string[];
}

export const COUNTRIES: readonly CountryConfig[] = [
  {
    code: "PK",
    slug: "pakistan",
    currency: "PKR",
    timeZone: "Asia/Karachi",
    gold: { karats: [24, 22, 21, 18], units: ["tola", "10g", "g"] },
    silver: { units: ["tola", "10g"] },
    primaryUnit: "tola",
    premiumPct: 0,
    premiumNote: "Calibrated daily against the APSGJA 24 karat rate when it is available.",
    fx: "pk-open-market",
    cities: ["karachi", "lahore", "islamabad", "rawalpindi", "peshawar", "quetta", "multan", "faisalabad", "hyderabad", "sialkot"],
  },
  gulf("AE", "uae", "AED", "Asia/Dubai"),
  gulf("SA", "saudi-arabia", "SAR", "Asia/Riyadh"),
  gulf("QA", "qatar", "QAR", "Asia/Qatar"),
  gulf("KW", "kuwait", "KWD", "Asia/Kuwait"),
  gulf("OM", "oman", "OMR", "Asia/Muscat"),
  gulf("BH", "bahrain", "BHD", "Asia/Bahrain"),
  {
    code: "GB",
    slug: "uk",
    currency: "GBP",
    timeZone: "Europe/London",
    gold: { karats: [24, 22, 18, 9], units: ["g", "oz"] },
    silver: { units: ["g", "oz", "kg"] },
    primaryUnit: "g",
    premiumPct: 0,
    fx: "reference",
  },
  {
    code: "US",
    slug: "usa",
    currency: "USD",
    timeZone: "America/New_York",
    gold: { karats: [24, 22, 18, 14], units: ["oz", "g"] },
    silver: { units: ["oz", "g", "kg"] },
    primaryUnit: "oz",
    premiumPct: 0,
    fx: "reference",
  },
  {
    code: "IN",
    slug: "india",
    currency: "INR",
    timeZone: "Asia/Kolkata",
    gold: { karats: [24, 22, 18], units: ["10g", "g"] },
    silver: { units: ["g", "kg"] },
    primaryUnit: "10g",
    premiumPct: 6,
    premiumNote:
      "Includes the 6% import levy on gold (5% basic customs duty plus 1% AIDC, Union Budget 2024-25). GST of 3% is charged on top at purchase and is not included.",
    fx: "reference",
  },
];

function gulf(code: RateCountry, slug: string, currency: string, timeZone: string): CountryConfig {
  return {
    code,
    slug,
    currency,
    timeZone,
    gold: { karats: [24, 22, 21, 18], units: ["g", "tola"] },
    silver: { units: ["g", "kg"] },
    primaryUnit: "g",
    premiumPct: 0,
    fx: "reference",
  };
}

export const countryByCode = (code: string): CountryConfig | undefined =>
  COUNTRIES.find((c) => c.code === code.toUpperCase());

export const countryBySlug = (slug: string): CountryConfig | undefined =>
  COUNTRIES.find((c) => c.slug === slug.toLowerCase() || c.code.toLowerCase() === slug.toLowerCase());

/** `YYYY-MM-DD` of `at` in `timeZone`. */
export function localDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
