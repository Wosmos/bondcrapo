/**
 * Locale-less public URL builders for pages owned by other lanes. Client safe (no server
 * imports). If a lane changes a slug, update it here and the sitemap follows.
 */
/** Matches Lane A: bearer codes as they are ("750"), premium spelled out ("premium-40000"). */
export const denominationSlug = (code: string): string =>
  code.toUpperCase().endsWith("P") ? `premium-${code.slice(0, -1)}` : code;

/** Matches Lane B's country config (`packages/ingest/src/markets/countries.ts`). */
export const COUNTRY_SLUGS: Record<string, string> = {
  PK: "pakistan",
  AE: "uae",
  SA: "saudi-arabia",
  QA: "qatar",
  KW: "kuwait",
  OM: "oman",
  BH: "bahrain",
  GB: "uk",
  US: "usa",
  IN: "india",
};

export const PK_GOLD_CITIES = [
  "karachi",
  "lahore",
  "islamabad",
  "rawalpindi",
  "peshawar",
  "quetta",
  "multan",
  "faisalabad",
  "hyderabad",
  "sialkot",
] as const;

export const paths = {
  home: "/",
  bonds: "/prize-bonds",
  check: "/prize-bonds/check",
  coverage: "/prize-bonds/coverage",
  denomination: (code: string) => `/prize-bonds/${denominationSlug(code)}`,
  draw: (code: string, drawNumber: number) => `/prize-bonds/${denominationSlug(code)}/${drawNumber}`,
  schedule: (year: number) => `/prize-bonds/schedule/${year}`,
  gold: "/gold-rate",
  goldCountry: (country: string) =>
    country.toUpperCase() === "PK" ? "/gold-rate" : `/gold-rate/${COUNTRY_SLUGS[country.toUpperCase()] ?? country.toLowerCase()}`,
  goldCity: (city: string) => `/gold-rate/pakistan/${city}`,
  silver: "/silver-rate",
  metal: (slug: string) => `/metals/${slug}`,
  currency: "/currency",
  pair: (pair: string) => `/currency/${pair}`,
  wallet: "/my",
  walletSettings: "/my/settings",
  download: "/download",
  about: "/about",
  data: "/about/data",
  privacy: "/privacy",
  terms: "/terms",
} as const;
