import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  "/gold-rate",
  "/gold-rate/uae",
  "/gold-rate/pakistan/lahore",
  "/silver-rate",
  "/metals/platinum",
  "/currency",
  "/currency/usd-to-pkr",
];

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

for (const locale of ["en", "ur"] as const) {
  for (const path of PAGES) {
    test(`${locale}${path}: renders, one h1, no serious axe violations`, async ({ page }) => {
      const res = await page.goto(`/${locale}${path}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ur" ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("note")).toBeVisible(); // sample data notice in fixture mode
      expect(await axe(page)).toEqual([]);
    });
  }
}

test("gold rate shows the reported APSGJA price with its badge", async ({ page }) => {
  await page.goto("/en/gold-rate");
  const hero = page.locator("section", { has: page.locator("#gold-hero") });
  await expect(hero).toContainText("437,836");
  await expect(hero).toContainText("Reported");
  await expect(page.getByRole("table").first()).toContainText("21K");
});

test("chart has an accessible table alternative and keyboard navigation", async ({ page }) => {
  await page.goto("/en/gold-rate");
  const slider = page.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuetext", /2026/);
  const before = await slider.getAttribute("aria-valuetext");
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).not.toHaveAttribute("aria-valuetext", before!);

  await page.getByText("Show the chart as a table").click();
  const table = page.getByTestId("chart-table");
  await expect(table).toBeVisible();
  await expect(table.locator("caption")).toContainText("Daily closing prices");
  expect(await table.locator("tbody tr").count()).toBeGreaterThan(20);
  await expect(page.locator("figcaption")).toContainText("over this period");
});

test("chart range buttons load another period from the API", async ({ page }) => {
  await page.goto("/en/metals/gold");
  const oneMonth = page.getByRole("button", { name: "1M" });
  await oneMonth.click();
  await expect(oneMonth).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("figcaption")).toContainText("over this period");
});

test("converter updates as you type and validates input", async ({ page }) => {
  await page.goto("/en/currency/usd-to-pkr");
  const amount = page.getByLabel("Amount");
  await amount.fill("250");
  await expect(page.locator("output")).toContainText("250 USD =");
  await amount.fill("abc");
  await expect(page.getByRole("alert").filter({ hasText: "greater than zero" })).toBeVisible();
});

test("Urdu pages keep Western digits for prices", async ({ page }) => {
  await page.goto("/ur/gold-rate");
  await expect(page.locator("section", { has: page.locator("#gold-hero") })).toContainText("437,836");
});
