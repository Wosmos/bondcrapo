import type { MetadataRoute } from "next";
import { siteOrigin } from "@/i18n/seo";
import { publicPages, sitemapChunkCount, sitemapEntries } from "@/i18n/sitemap";
import { sitemapSources } from "@/i18n/sitemap-data";

// Regenerated hourly; ingestion adds a handful of draws per week.
export const revalidate = 3600;

/** Served at /sitemap/<id>.xml; /sitemap-index.xml and robots.txt list every file. */
export async function generateSitemaps() {
  const count = sitemapChunkCount(publicPages(await sitemapSources()));
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number.parseInt(await props.id, 10) || 0;
  return sitemapEntries(publicPages(await sitemapSources()), siteOrigin(), id);
}
