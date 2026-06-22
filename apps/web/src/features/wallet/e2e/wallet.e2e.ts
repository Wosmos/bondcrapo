import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Lane C2 acceptance: create, add, restore on a second browser context with the sync code;
 * offline view shows cached bonds; axe passes; keyboard-only flow works. Both locales.
 * Fixture draw (sql-bridge.mjs): Rs 750, 15 Jan 2025, 123456 won a 3rd prize of Rs 9,300.
 */

// Dev mode compiles each route on first request; do it once up front so steps never time out on it.
test.beforeAll(async ({ request }) => {
  test.setTimeout(600_000);
  for (const locale of ["en", "ur"]) {
    for (const path of ["", "/bonds", "/wins", "/near-misses", "/settings", "/restore"]) {
      await request.get(`/${locale}/my${path}`, { timeout: 300_000 });
    }
  }
});

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function readSyncCode(page: Page): Promise<string> {
  const code = (await page.getByTestId("sync-code").innerText()).trim();
  expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  return code;
}

test("create, add bonds, then restore on a second device with the sync code", async ({ page, browser }) => {
  await page.goto("/en/my");
  await expect(page.getByRole("heading", { level: 1, name: "My bonds" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Track your prize bonds without signing up" })).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await page.getByRole("link", { name: "Add your first bond" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Manage my bonds" })).toBeVisible();
  await page.getByLabel("Bond number").fill("123456");
  await page.getByRole("button", { name: "Add 1 bond" }).click();
  await expect(page.getByText("1 bond added")).toBeVisible();
  await expect(page.getByText("Good news: 1 past win found!")).toBeVisible();
  const firstCode = await readSyncCode(page);

  await page.getByText("Range", { exact: true }).click();
  await page.getByLabel("First number").fill("200000");
  await page.getByLabel("Last number").fill("200009");
  await page.getByRole("button", { name: "Add 10 bonds" }).click();
  await expect(page.getByText("10 bonds added")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your 11 bonds" })).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await page.getByRole("button", { name: "I have saved it" }).click();
  await expect(page.getByTestId("sync-code-card")).toHaveCount(0);

  await page.getByRole("link", { name: /^Wins/ }).click();
  const row = page.getByRole("row").filter({ hasText: "123456" });
  await expect(row).toContainText("Rs 9,300");
  await expect(row).toContainText("3rd prize");
  await expectNoSeriousA11yIssues(page);

  // A second browser profile: the QR link carries the code in the URL fragment.
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto(`/en/my/restore#code=${firstCode}`);
  await expect(phone.getByTestId("restore-code")).toHaveValue(firstCode);
  await expectNoSeriousA11yIssues(phone);
  await phone.getByRole("button", { name: "Open wallet" }).click();
  await expect(phone).toHaveURL(/\/en\/my$/);
  await expect(phone.getByText("Bonds", { exact: true }).first()).toBeVisible();
  await expect(phone.locator("dd").filter({ hasText: /^11$/ })).toBeVisible();
  const secondCode = await readSyncCode(phone);
  expect(secondCode).not.toBe(firstCode);

  // The first device's token was replaced: it now explains what happened.
  await page.goto("/en/my");
  await expect(page.getByText("This wallet is closed on this device")).toBeVisible();

  // The used code is retired.
  const third = await browser.newContext();
  const stranger = await third.newPage();
  await stranger.goto("/en/my/restore");
  await stranger.getByTestId("restore-code").fill(firstCode);
  await stranger.getByRole("button", { name: "Open wallet" }).click();
  await expect(stranger.getByText(/No wallet matches this code/)).toBeVisible();
  await other.close();
  await third.close();
});

test("offline: the saved copy of the wallet is shown", async ({ page, context }) => {
  await page.goto("/en/my/bonds");
  await page.getByLabel("Bond number").fill("654321");
  await page.getByRole("button", { name: "Add 1 bond" }).click();
  await expect(page.getByText("1 bond added")).toBeVisible();

  // Cut the API off and drop the network, then reload: the page renders from the local copy.
  await context.route("**/api/v1/**", (route) => route.abort("internetdisconnected"));
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByText("You are offline")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "654321" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add/ }).last()).toBeDisabled();
  await context.setOffline(false);
});

test("keyboard only, in Urdu (RTL): paste a list and add it", async ({ page }) => {
  await page.goto("/ur/my/bonds");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "میرے بانڈز کا انتظام" })).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  // Focus the first mode radio, then move with the arrow keys like any radio group.
  await page.getByRole("radio", { name: "ایک بانڈ" }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "فہرست پیسٹ کریں" })).toBeChecked();

  await page.keyboard.press("Tab"); // denomination
  await page.keyboard.press("Tab"); // textarea
  await expect(page.getByTestId("add-paste")).toBeFocused();
  await page.keyboard.type("300001, 300002\n300003");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "3 بانڈز شامل کریں" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("3 بانڈز شامل ہو گئے")).toBeVisible();
  // Bond numbers keep Western digits inside RTL text.
  await expect(page.getByRole("row").filter({ hasText: "300002" })).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await page.goto("/ur/my/settings");
  await expect(page.getByRole("heading", { level: 1, name: "والٹ کی ترتیبات" })).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});
