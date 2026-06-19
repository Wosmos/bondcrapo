import type { MetadataRoute } from "next";
import { siteOrigin } from "@/i18n/seo";
import { publicPages, sitemapChunkCount } from "@/i18n/sitemap";
import { sitemapSources } from "@/i18n/sitemap-data";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = siteOrigin();
  const count = sitemapChunkCount(publicPages(await sitemapSources()));
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Personal wallet pages, JSON API and the offline fallback are not search content.
        disallow: ["/api/", "/en/my", "/ur/my", "/en/offline", "/ur/offline"],
      },
    ],
    sitemap: [`${origin}/sitemap-index.xml`, ...Array.from({ length: count }, (_, id) => `${origin}/sitemap/${id}.xml`)],
    host: origin,
  };
}
