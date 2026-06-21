import { COUNTRIES } from "@bondcheck/ingest/markets/countries";
import { POPULAR_PKR_PAIRS } from "@bondcheck/ingest/markets/currencies";
import { METAL_SLUGS, pairSlug } from "./lib/slugs";

/**
 * Locale-less paths of every static market page, for the sitemap (Lane D imports this).
 * Other currency pairs exist on demand but are not listed.
 */
export function marketsSitemapPaths(): string[] {
  const pk = COUNTRIES.find((c) => c.code === "PK")!;
  return [
    "/gold-rate",
    ...COUNTRIES.filter((c) => c.code !== "PK").map((c) => `/gold-rate/${c.slug}`),
    ...(pk.cities ?? []).map((city) => `/gold-rate/pakistan/${city}`),
    "/silver-rate",
    ...Object.keys(METAL_SLUGS).map((m) => `/metals/${m}`),
    "/currency",
    ...POPULAR_PKR_PAIRS.map((c) => `/currency/${pairSlug(c, "PKR")}`),
  ];
}
