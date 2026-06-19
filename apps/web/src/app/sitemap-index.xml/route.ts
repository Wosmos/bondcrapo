import { siteOrigin } from "@/i18n/seo";
import { publicPages, sitemapChunkCount } from "@/i18n/sitemap";
import { sitemapSources } from "@/i18n/sitemap-data";

export const revalidate = 3600;

/** Sitemap index (sitemaps.org) pointing at every /sitemap/<id>.xml file. */
export async function GET(): Promise<Response> {
  const origin = siteOrigin();
  const count = sitemapChunkCount(publicPages(await sitemapSources()));
  const items = Array.from(
    { length: count },
    (_, id) => `  <sitemap><loc>${origin}/sitemap/${id}.xml</loc></sitemap>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600" },
  });
}
