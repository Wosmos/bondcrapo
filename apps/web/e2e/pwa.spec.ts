import { expect, test } from "@playwright/test";

test("manifest is valid and Chrome reports no installability errors", async ({ page, context }) => {
  const res = await page.request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);

  await page.goto("/en");
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker.getRegistration()));
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
});

test("a visited page reloads offline, an unvisited one shows the offline page", async ({ page, context }) => {
  await page.goto("/en/about");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Give the worker time to cache what the page already loaded before it took control.
  await page.waitForFunction(async () => {
    const cache = await caches.open("bc-pages-v1");
    return Boolean(await cache.match(location.href));
  });
  await page.waitForFunction(async () => (await (await caches.open("bc-static-v1")).keys()).length > 3);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "About BondCheck" })).toBeVisible();
  // Styles came from the cache too.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");

  await page.goto("/ur/terms");
  await expect(page.getByRole("heading", { level: 1, name: "آپ آف لائن ہیں" })).toBeVisible();
  await context.setOffline(false);
});

test("sitemap index, sitemap and robots.txt", async ({ request }) => {
  const index = await (await request.get("/sitemap-index.xml")).text();
  expect(index).toContain("<sitemapindex");
  expect(index).toContain("/sitemap/0.xml");

  const sitemap = await (await request.get("/sitemap/0.xml")).text();
  expect(sitemap).toContain("<urlset");
  // The origin is fixed at build time from APP_BASE_URL, so only paths are asserted here.
  expect(sitemap).toMatch(/<loc>https?:\/\/[^<]+\/ur\/prize-bonds\/750<\/loc>/);
  expect(sitemap).toMatch(/hreflang="ur"\s+href="https?:\/\/[^"]+\/ur\/currency\/usd-to-pkr"/);
  expect(sitemap).toContain('hreflang="x-default"');

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Sitemap: https?:\/\/\S+\/sitemap-index\.xml/);
  expect(robots).toContain("Disallow: /api/");
});

test("pages carry canonical, hreflang and Open Graph tags", async ({ page }) => {
  await page.goto("/ur/about");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/ur\/about$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/en\/about$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/about$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  const og = await page.request.get((await page.locator('meta[property="og:image"]').getAttribute("content"))!.replace(/^https?:\/\/[^/]+/, ""));
  expect(og.headers()["content-type"]).toContain("image/png");
});
