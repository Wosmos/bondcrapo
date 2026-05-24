import { beforeAll, describe, expect, it } from "vitest";
import { draws } from "@bondcheck/db";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import {
  MAX_URLS_PER_SITEMAP,
  loadSitemapSources,
  NO_SOURCES,
  publicPages,
  sitemapChunkCount,
  sitemapEntries,
  type SitemapDraw,
} from "./sitemap";

const ORIGIN = "https://bondcheck.test";

describe("sitemap builders", () => {
  it("lists static, denomination, country, metal and pair pages without a database", () => {
    const paths = publicPages(NO_SOURCES).map((p) => p.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/prize-bonds/750");
    expect(paths).toContain("/prize-bonds/premium-40000");
    expect(paths).toContain("/gold-rate/uae");
    expect(paths).toContain("/gold-rate/pakistan/lahore");
    expect(paths).toContain("/metals/gold");
    expect(paths).toContain("/currency/usd-to-pkr");
    expect(paths).toContain("/about/data");
    expect(paths.some((p) => p.startsWith("/my"))).toBe(false);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("emits one entry per locale with en, ur and x-default alternates", () => {
    const entries = sitemapEntries(publicPages(NO_SOURCES).slice(0, 2), ORIGIN);
    expect(entries.map((e) => e.url)).toEqual([
      `${ORIGIN}/en`,
      `${ORIGIN}/ur`,
      `${ORIGIN}/en/prize-bonds`,
      `${ORIGIN}/ur/prize-bonds`,
    ]);
    expect(entries[2].alternates?.languages).toEqual({
      en: `${ORIGIN}/en/prize-bonds`,
      ur: `${ORIGIN}/ur/prize-bonds`,
      "x-default": `${ORIGIN}/prize-bonds`,
    });
  });

  it("splits into files of at most 50,000 URLs (sitemap index)", () => {
    const many: SitemapDraw[] = Array.from({ length: 30_000 }, (_, i) => ({
      denominationCode: "750",
      drawNumber: i + 1,
      drawDate: "2020-01-15",
      updatedAt: null,
    }));
    const pages = publicPages({ draws: many, years: [] });
    const count = sitemapChunkCount(pages);
    expect(count).toBe(2);
    const first = sitemapEntries(pages, ORIGIN, 0);
    const second = sitemapEntries(pages, ORIGIN, 1);
    expect(first).toHaveLength(MAX_URLS_PER_SITEMAP);
    expect(first.length + second.length).toBe(pages.length * 2);
    expect(new Set([...first, ...second].map((e) => e.url)).size).toBe(pages.length * 2);
  });

  it("renders valid sitemap XML through Next's serializer shape", () => {
    for (const e of sitemapEntries(publicPages(NO_SOURCES), ORIGIN)) {
      expect(() => new URL(e.url)).not.toThrow();
      expect(e.priority).toBeGreaterThan(0);
      expect(e.priority).toBeLessThanOrEqual(1);
    }
  });
});

describe("loadSitemapSources (PGlite)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
    await t.db.insert(draws).values([
      { denominationCode: "750", drawNumber: 104, drawDate: "2025-10-15", status: "verified", completeness: "full" },
      { denominationCode: "200", drawNumber: 99, drawDate: "2025-12-15", status: "published", completeness: "full" },
      { denominationCode: "1500", drawNumber: 104, drawDate: "2026-02-16", status: "disputed", completeness: "top" },
      { denominationCode: "100", drawNumber: 60, drawDate: "2026-11-16", status: "scheduled" },
      { denominationCode: "40000P", drawNumber: null, drawDate: "2024-03-11", status: "published" },
    ]);
  });

  it("returns only draws with a public result page, and every draw year", async () => {
    const sources = await loadSitemapSources(t.db);
    expect(sources.draws.map((d) => `${d.denominationCode}/${d.drawNumber}`).sort()).toEqual([
      "1500/104",
      "200/99",
      "750/104",
    ]);
    expect(sources.years.sort()).toEqual([2024, 2025, 2026]);

    const paths = publicPages(sources).map((p) => p.path);
    expect(paths).toContain("/prize-bonds/750/104");
    expect(paths).toContain("/prize-bonds/schedule/2026");
    expect(paths.filter((p) => /^\/prize-bonds\/(?:premium-)?\d+\/\d+$/.test(p))[0]).toBe("/prize-bonds/1500/104");
  });
});
