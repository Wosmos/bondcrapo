import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Prize bond end to end tests (Lane A). Runs `next dev` on this lane's port with
 * BONDS_DATA=fixtures, so every page shows the recorded official documents without a database.
 *
 *   bun run --cwd apps/web playwright test -c src/features/bonds/e2e/playwright.config.ts
 */
const port = Number(process.env.E2E_PORT ?? 3101);
const baseURL = `http://localhost:${port}`;
// Paths are relative to apps/web, where the command runs (Playwright loads this config as CommonJS).
const webDir = process.cwd();
const fixtures = `${resolve(webDir, "../../packages/ingest/fixtures/bonds")}/`;

export default defineConfig({
  testDir: ".",
  // `.e2e.ts`, so Vitest (which collects *.spec.ts) never picks these up.
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `bunx next dev -p ${port}`,
    cwd: webDir,
    url: `${baseURL}/en/prize-bonds`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { BONDS_DATA: "fixtures", BONDS_FIXTURE_DIR: fixtures, ANALYTICS_PROVIDER: "none", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
