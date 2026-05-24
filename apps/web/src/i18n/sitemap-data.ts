import "server-only";
import { getDb } from "@/server/db";
import { loadSitemapSources, NO_SOURCES, type SitemapSources } from "./sitemap";

/**
 * Sitemap sources for the running deployment. Without `DATABASE_URL` (local or CI builds) or when
 * the database is unreachable, the sitemap still lists every static, denomination, country and
 * pair page; draw pages appear on the next revalidation.
 */
export async function sitemapSources(): Promise<SitemapSources> {
  if (!process.env.DATABASE_URL) return NO_SOURCES;
  try {
    return await loadSitemapSources(getDb());
  } catch (error) {
    console.error("sitemap: draw list unavailable", error instanceof Error ? error.message : error);
    return NO_SOURCES;
  }
}
