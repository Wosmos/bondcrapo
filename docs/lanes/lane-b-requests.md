# Lane B (markets) requests for the integrator

Changes Lane B needs in files it does not own. Each item says why and gives the exact change.

## 1. `apps/web/src/app/api/v1/routes.test.ts` (M1): stop expecting 501 from built endpoints

The second test asserts that every contract endpoint answers `501 not_implemented`. The seven
`markets.*` endpoints are implemented now (they answer 400 for a missing required query, or 503
when no database is configured), so that test fails on this branch by design. Other lanes hit the
same assertion as they ship. Suggested change: skip ids of implemented areas, for example

```ts
const skip = new Set(["cron.get", "cron.post", "ops.health"]);
const built = (id: string) => id.startsWith("markets.");
for (const e of all.filter((x) => !skip.has(x.id) && !built(x.id))) {
```

Note: on the M1 baseline the first test of that file already fails because the contract
`GET /bonds/coverage` has no stub route (`apps/web/src/app/api/v1/bonds/coverage/route.ts`, Lane A),
and the second fails on the same missing import before it reaches any markets endpoint.

Contract coverage for markets lives in `apps/web/src/features/markets/markets-api.test.ts` (every
endpoint parsed with its zod schema).

## 2. `packages/ingest/package.json` scripts

```json
"backfill:markets": "tsx src/markets/backfill-cli.ts",
"markets:e2e-snapshot": "tsx src/markets/e2e-snapshot.ts ../../apps/web/src/features/markets/e2e/snapshot.json"
```

Lane B added `zod` (4.6.7, the version `@bondcheck/shared` already uses) as a dependency of
`@bondcheck/ingest` for parser output validation.

## 3. `apps/web/package.json` script

```json
"e2e:markets": "playwright test -c src/features/markets/e2e/playwright.config.ts"
```

Lane B added `@playwright/test` 1.64.1 and `@axe-core/playwright` 4.14.0 as dev dependencies (the
same versions lanes C and D use). Regenerate the lockfile on merge.

## 4. `apps/web/src/platform/env.ts`: three optional variables

```ts
/** HMAC key for rate limit subjects (32+ chars). Falls back to CRON_SECRET with domain separation. */
RATE_LIMIT_PEPPER: z.string().min(32).optional(),
/** "1" once the FreeGoldAPI licence is confirmed: enables the monthly gold history before 2024. */
MARKETS_ALLOW_FREEGOLDAPI: z.enum(["1"]).optional(),
/** Development and end to end tests only: JSON snapshot served instead of the database. Never set in production. */
MARKETS_FIXTURE_FILE: z.string().min(1).optional(),
```

The markets code reads them from `process.env` directly today.

## 5. Sitemap (Lane D): include the market pages

`apps/web/src/features/markets/sitemap.ts` exports `marketsSitemapPaths()` (locale-less paths:
gold rate for 10 countries and 10 Pakistani cities, silver, four metals, currency and 16 rupee
pairs). Please add them for both locales with `ur` alternates.

## 6. Home page tiles (Lane D)

Server loaders with caching and graceful failure are in
`apps/web/src/features/markets/server/data.ts`: `loadLocalRates("PK")` (24K tola is
`metal "XAU", karat 24, unit "tola"`, prefer `kind "reported"`), `loadPkrRates()` (USD open market
and interbank) and `loadMetalsLatest("USD")`. Each returns `{ ok: false }` instead of throwing.

## 7. Theme tokens (Lane D)

Market surfaces use a light palette (`bg-white`, `border-slate-200`) through the `surface` constant
in `apps/web/src/features/markets/components/bits.tsx` and the primitives. When dark mode tokens
land, map `surface` and the chart colours (`TONES` in `PriceChart.tsx`) to them.

## 8. Workflows

Market schedules are in `.github/workflows/ingest-markets.yml` (Lane B's own file, as PLAN 14
prefers). It needs the repository secrets `APP_BASE_URL`, `CRON_SECRET` and, for the manual history
backfill, `DATABASE_URL`. `apps/web/vercel.json` already lists the daily safety net for
`metals-spot`, `fx-daily` and `pk-market`; nothing to change there.

## Owner actions

1. Optional: a MetalpriceAPI key as `METALS_FALLBACK_API_KEY` (the fallback for gold-api.com).
2. Licence check for FreeGoldAPI (monthly gold history 2000 to 2024, World Bank Pink Sheet rows
   only); set `MARKETS_ALLOW_FREEGOLDAPI=1` and run `backfill-cli.ts --gold-monthly` only after that.
3. Courtesy emails to Forex.pk (open market rates) and APP (APSGJA gold stories) about attributed
   reuse; the State Bank sheets (WACER, M2M, ECAP) are official publications and serve as fallback.
4. Review the India import levy in `packages/ingest/src/markets/countries.ts` (6%) whenever the
   Union Budget changes it.
5. Run the history backfill once after the M1 migration is applied:
   `pnpm --filter @bondcheck/ingest exec tsx src/markets/backfill-cli.ts --from 2024-03-02`
   (or the `history-backfill` choice of the workflow). Daily history before 2024-03-02 has no free
   licensed source; the long range chart starts there unless item 2 is cleared.
