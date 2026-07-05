import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockBoard, PAGES, showBoard, url } from "./fixtures";

// page.route cannot see requests made by a service worker; the PWA spec covers the worker.
test.use({ serviceWorkers: "block" });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const locale of ["en", "ur"]) {
  for (const path of [...PAGES, "/no-such-page"]) {
    test(`axe: ${url(locale, path)} has no serious or critical issues`, async ({ page }) => {
      await mockBoard(page);
      await page.goto(url(locale, path));
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ur" ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      if (path === "/") await showBoard(page);
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(blocking.map((v) => `${scheme} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      }
    });
  }
}

test("skip link is the first stop and moves focus to the main content", async ({ page }) => {
  await page.goto("/en/about");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("the home board shows live data with labels, and a retry path when the API fails", async ({ page }) => {
  await mockBoard(page);
  await page.goto("/en");
  await showBoard(page);
  const board = page.locator('[aria-busy="false"]');
  await expect(board.getByRole("link", { name: /Rs 750.*Draw 104.*Verified/ })).toBeVisible();
  await expect(board.getByText("Under review")).toBeVisible();
  await expect(board.getByText("Estimated")).toBeVisible();
  await expect(board.getByText("Rs 400,000")).toBeVisible();
  await expect(board.getByRole("row", { name: /Open market 280.10 281.20/ })).toBeVisible();

  await page.unrouteAll();
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"code":"unavailable","message":"down"}}' }),
  );
  await page.reload();
  await page.locator("#board-title").scrollIntoViewIfNeeded();
  await expect(page.getByText("Live figures are not available right now.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" }).first()).toBeVisible();
});

test("theme toggle switches light and dark and survives a reload and a language change", async ({ page }) => {
  await page.goto("/en/about");
  const toggle = page.getByRole("button", { name: /^Theme:/ });
  // Nothing chosen yet: the device setting (light in the test browser).
  await expect(toggle).toHaveAccessibleName(/Light/);
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: /^Theme: Dark/ })).toBeVisible();
  // Switching language re-renders the root layout; the choice must stay.
  await page.getByRole("link", { name: /read this page in Urdu/ }).click();
  await expect(page).toHaveURL(/\/ur\/about$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /^تھیم:/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("language switcher keeps the page and flips direction", async ({ page }) => {
  await page.goto("/en/privacy");
  await page.getByRole("link", { name: /read this page in Urdu/ }).click();
  await expect(page).toHaveURL(/\/ur\/privacy$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: /یہ صفحہ انگریزی میں پڑھیں/ }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
});

test("quick check submits to the checker with the number", async ({ page }) => {
  await page.goto("/en");
  await page.getByLabel("Bond number").fill("12345");
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.getByLabel("Bond number").fill("123456");
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page).toHaveURL(/\/en\/prize-bonds\/check\?numbers=123456&denomination=$/);
});
