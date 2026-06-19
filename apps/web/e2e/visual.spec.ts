import { expect, test } from "@playwright/test";
import { mockBoard, showBoard } from "./fixtures";

// page.route cannot see requests made by a service worker; the PWA spec covers the worker.
test.use({ serviceWorkers: "block" });

/**
 * Visual snapshots, Urdu (RTL) first. Baselines live in visual.spec.ts-snapshots and are
 * platform specific; refresh them with `pnpm e2e --update-snapshots` after intended changes.
 */
for (const locale of ["ur", "en"]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${locale} home, ${scheme}`, async ({ page }) => {
      await mockBoard(page);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(`/${locale}`);
      await page.evaluate(() => document.fonts.ready);
      await showBoard(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page).toHaveScreenshot(`${locale}-home-${scheme}.png`, { fullPage: true, timeout: 45_000 });
    });
  }
}

test("ur about page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ur/about");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("ur-about.png", { fullPage: true, timeout: 45_000 });
});

test("RTL layout mirrors: logo at the start edge, tab bar order reversed", async ({ page }) => {
  await page.goto("/ur");
  const logo = await page.getByRole("link", { name: "بانڈ چیک ہوم پیج" }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(logo!.x).toBeGreaterThan(viewport.width / 2);
  const tabs = page.getByRole("navigation", { name: "حصے" }).getByRole("link");
  const first = await tabs.first().boundingBox();
  const last = await tabs.last().boundingBox();
  expect(first!.x).toBeGreaterThan(last!.x);
});
