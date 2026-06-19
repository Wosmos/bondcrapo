import { defineConfig, devices } from "@playwright/test";

/**
 * End to end tests (PLAN section 12): Chromium with mobile emulation against a production
 * build. Run `pnpm build` first, then `pnpm e2e`. Port 3104 is this lane's port; override with
 * E2E_PORT. Snapshots are stored per platform next to the specs.
 */
const port = Number(process.env.E2E_PORT ?? 3104);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: `${baseURL}/en`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { APP_BASE_URL: baseURL, ANALYTICS_PROVIDER: "none" },
  },
});
