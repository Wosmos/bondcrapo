import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Zero serious or critical axe violations (PLAN section 9), checked on every bond page type. */
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

const PAGES = [
  "/prize-bonds",
  "/prize-bonds/750",
  "/prize-bonds/750/107",
  "/prize-bonds/premium-25000/23",
  "/prize-bonds/schedule/2026",
  "/prize-bonds/check",
  "/prize-bonds/coverage",
];

for (const locale of ["en", "ur"] as const) {
  test.describe(`prize bond pages (${locale})`, () => {
    for (const path of PAGES) {
      test(`${path} has one h1, the right direction and passes axe`, async ({ page }) => {
        const res = await page.goto(`/${locale}${path}`);
        expect(res?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ur" ? "rtl" : "ltr");
        await expect(page.locator("h1")).toHaveCount(1);
        await expectAccessible(page);
      });
    }
  });
}

test("the draw page shows the official first prize and finds a number in the list", async ({ page }) => {
  await page.goto("/en/prize-bonds/750/107");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rs 750 prize bond draw 107");
  await expect(page.getByRole("region", { name: "First prize" })).toContainText("976106");
  await page.getByLabel("Bond number").fill("000381");
  await page.getByRole("button", { name: "Find" }).click();
  // The first lookup fetches the draw's list (slow on a cold dev server).
  await expect(page.getByText("000381 won the third prize in this draw: Rs 9,300.")).toBeVisible({ timeout: 90_000 });
});

test("the checker finds a known winning fixture number and announces the result", async ({ page }) => {
  await page.goto("/en/prize-bonds/check");
  await page.getByLabel("Bond numbers").fill("My bonds: 976106, 123456 and 000381");
  await expect(page.getByText("3 numbers found")).toBeVisible();
  await page.getByRole("button", { name: "Check 3 numbers" }).click();
  await expect(page.getByText("2 wins among 3 numbers checked.")).toBeVisible();
  const table = page.getByRole("table", { name: "Winning numbers, newest draw first" });
  await expect(table.getByRole("row", { name: /976106/ })).toContainText("First prize");
  await expect(table.getByRole("row", { name: /976106/ })).toContainText("Rs 1,500,000");
});

test("the hub quick check works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/prize-bonds");
  await page.getByLabel("Bond numbers").fill("976106");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/prize-bonds\/check\?numbers=976106/);
  await context.close();
});

test("Urdu pages keep bond numbers in Western digits, left to right", async ({ page }) => {
  await page.goto("/ur/prize-bonds/750/107");
  const first = page.locator("bdi[dir=ltr]", { hasText: "976106" }).first();
  await expect(first).toBeVisible();
});
