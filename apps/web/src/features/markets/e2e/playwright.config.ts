import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Market pages end to end (Lane B). Runs the web app on the lane port against the recorded
 * snapshot (no database, no network):
 *
 *   pnpm --filter web exec playwright test -c src/features/markets/e2e/playwright.config.ts
 *
 * Set MARKETS_E2E_BASE_URL to test an already running server instead (for example `next start`).
 */
// Playwright loads this config as CommonJS, so __dirname is available.
const webRoot = resolve(__dirname, "../../../..");
const snapshot = resolve(__dirname, "snapshot.json");
const external = process.env.MARKETS_E2E_BASE_URL;
const port = 3102;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.e2e\.ts$/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  outputDir: join(tmpdir(), "bondcheck-markets-e2e"),
  reporter: [["list"]],
  use: { baseURL: external ?? `http://localhost:${port}`, trace: "off" },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: external
    ? undefined
    : {
        command: `pnpm exec next dev --port ${port}`,
        cwd: webRoot,
        port,
        timeout: 240_000,
        reuseExistingServer: false,
        env: { MARKETS_FIXTURE_FILE: snapshot, NEXT_TELEMETRY_DISABLED: "1" },
      },
});
