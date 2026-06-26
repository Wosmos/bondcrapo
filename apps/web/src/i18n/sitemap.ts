import type { MetadataRoute } from "next";
import { and, isNotNull, inArray, sql } from "drizzle-orm";
import { DENOMINATION_CODES } from "@bondcheck/shared/constants";
import { draws, type Db } from "@bondcheck/db";
import { routing } from "./routing";
import { marketsSitemapPaths } from "@/features/markets/sitemap";
import { paths } from "./paths";
import { absoluteUrl, languageAlternates } from "./seo";

/**
 * Sitemap builders (PLAN section 14, D2). Pure functions plus one read-only query, so the
 * route in `app/sitemap.ts` stays thin and everything here is unit tested on PGlite.
 *
 * Bond slugs come from `features/bonds/labels.ts` and market paths from
 * `features/markets/sitemap.ts`, so each feature owns its own URLs.
 */

/** Google's limit per sitemap file. Each page yields one entry per locale. */
export const MAX_URLS_PER_SITEMAP = 50_000;

type Freq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

export interface SitemapPage {
  /** Locale-less path. */
  path: string;
  lastModified?: Date;
  changeFrequency: Freq;
  priority: number;
}

export interface SitemapDraw {
  denominationCode: string;
  drawNumber: number;
  drawDate: string;
  updatedAt: Date | null;
}

export interface SitemapSources {
  draws: SitemapDraw[];
  /** Years that have at least one draw (published or scheduled). */
  years: number[];
}


const STATIC_PAGES: SitemapPage[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/prize-bonds", changeFrequency: "daily", priority: 0.9 },
  { path: "/prize-bonds/check", changeFrequency: "weekly", priority: 0.9 },
  { path: "/prize-bonds/coverage", changeFrequency: "weekly", priority: 0.5 },
  { path: "/download", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "yearly", priority: 0.3 },
  { path: "/about/data", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

/** Every public, indexable page. The wallet (`/my`) and the offline page are private or thin. */
export function publicPages(sources: SitemapSources): SitemapPage[] {
  const pages: SitemapPage[] = [...STATIC_PAGES];

  for (const code of DENOMINATION_CODES) {
    pages.push({ path: paths.denomination(code), changeFrequency: "weekly", priority: 0.8 });
  }
  for (const year of [...new Set(sources.years)].sort((a, b) => b - a)) {
    pages.push({ path: paths.schedule(year), changeFrequency: "monthly", priority: 0.5 });
  }
  // Market pages: the list is owned by the markets feature.
  for (const path of marketsSitemapPaths()) {
    const top = path === "/gold-rate" || path === "/currency" || path === "/silver-rate";
    pages.push({ path, changeFrequency: "hourly", priority: path === "/gold-rate" ? 0.9 : top ? 0.8 : 0.6 });
  }
  // Newest draws first so the first sitemap file always carries the freshest results.
  const sorted = [...sources.draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  for (const d of sorted) {
    pages.push({
      path: paths.draw(d.denominationCode, d.drawNumber),
      lastModified: d.updatedAt ?? new Date(`${d.drawDate}T00:00:00Z`),
      changeFrequency: "yearly",
      priority: 0.6,
    });
  }
  return pages;
}

export const entryCount = (pages: SitemapPage[]): number => pages.length * routing.locales.length;

export const sitemapChunkCount = (pages: SitemapPage[]): number =>
  Math.max(1, Math.ceil(entryCount(pages) / MAX_URLS_PER_SITEMAP));

/** Entries for chunk `id`: one entry per page and locale, each with its hreflang alternates. */
export function sitemapEntries(pages: SitemapPage[], origin: string, id = 0): MetadataRoute.Sitemap {
  const perChunk = Math.floor(MAX_URLS_PER_SITEMAP / routing.locales.length);
  return pages.slice(id * perChunk, (id + 1) * perChunk).flatMap((page) => {
    const languages = languageAlternates(page.path, origin);
    return routing.locales.map((locale) => ({
      url: absoluteUrl(locale, page.path, origin),
      ...(page.lastModified ? { lastModified: page.lastModified } : {}),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}

/** Read-only: draws that have a public page (published, verified or disputed with a number). */
export async function loadSitemapSources(db: Db): Promise<SitemapSources> {
  const rows = await db
    .select({
      denominationCode: draws.denominationCode,
      drawNumber: draws.drawNumber,
      drawDate: draws.drawDate,
      updatedAt: draws.updatedAt,
    })
    .from(draws)
    .where(and(isNotNull(draws.drawNumber), inArray(draws.status, ["published", "verified", "disputed"])));
  const yearRows = await db
    .selectDistinct({ year: sql<number>`extract(year from ${draws.drawDate})::int` })
    .from(draws);
  return {
    draws: rows.map((r) => ({ ...r, drawNumber: r.drawNumber as number })),
    years: yearRows.map((r) => Number(r.year)),
  };
}

/** Empty sources: used when no database is configured (local builds, CI). */
export const NO_SOURCES: SitemapSources = { draws: [], years: [] };
