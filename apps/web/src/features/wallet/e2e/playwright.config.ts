import { defineConfig, devices } from "@playwright/test";

/**
 * Wallet end-to-end tests (PLAN Lane C2). They run against `next dev` on the lane port with the
 * Neon HTTP driver pointed at a local PGlite bridge, so no real database is involved.
 *   bun run --cwd apps/web playwright test -c src/features/wallet/e2e/playwright.config.ts
 */
const PORT = Number(process.env.WALLET_E2E_PORT ?? 3103);
const SQL_PORT = Number(process.env.WALLET_E2E_SQL_PORT ?? 3193);

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The first request compiles each route in dev mode, which is slow on small machines.
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    navigationTimeout: 180_000,
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: [
    {
      command: `node sql-bridge.mjs ${SQL_PORT}`,
      cwd: __dirname,
      url: `http://127.0.0.1:${SQL_PORT}/health`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: `next dev -p ${PORT}`,
      cwd: `${__dirname}/../../../..`,
      url: `http://localhost:${PORT}/en/my`,
      reuseExistingServer: true,
      timeout: 600_000,
      env: {
        // A placeholder URL: the driver is redirected to the bridge and never connects to it.
        DATABASE_URL: "postgresql://e2e:e2e@127.0.0.1:5432/e2e",
        WALLET_E2E_SQL_ENDPOINT: `http://127.0.0.1:${SQL_PORT}/sql`,
        WALLET_PEPPER: "e2e-pepper-for-local-tests-only-0123456789",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
