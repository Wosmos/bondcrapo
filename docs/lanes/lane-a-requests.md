# Lane A (prize bonds) requests for the integrator

Changes Lane A needs in files it does not own, and merge notes. Each item says why and what to do.

## 1. `apps/web/src/app/api/v1/routes.test.ts` (M1)

The test "unbuilt endpoints answer 501" calls every contract endpoint with empty params and
expects 501. The bond endpoints are implemented, so they answer 400 (invalid params) or 503 (no
database in the test environment). Skip implemented endpoints, for example:

```ts
const implemented = (id: string) => id.startsWith("bonds.") || id.startsWith("wallets.");
for (const e of all.filter((x) => !skip.has(x.id) && !implemented(x.id))) { ... }
```

The bond handlers are covered by `apps/web/src/app/api/v1/bonds/bonds.test.ts`, which parses every
response with the shared contract. The missing `apps/web/src/app/api/v1/bonds/coverage/route.ts`
that the first test in this file expects is now present.

## 2. `apps/web/src/app/api/v1/cron/cron.test.ts` (M1)

"with the right secret an unbuilt job answers 501" uses `bonds-sync`, which is now registered (it
answers 500 without `DATABASE_URL`). Use a job that stays unbuilt in that test, or stub `getDb`.

## 3. `packages/ingest/package.json`

Lane A added `pdfjs-dist` 5.6.205 (server side PDF text extraction, loaded lazily) and `zod` to
`dependencies`, and two scripts: `backfill:bonds` and `coverage:bonds`. Keep them when merging
Lane B's changes to the same file; regenerate the lockfile.

## 4. `Fetcher.post` (packages/ingest/src/fetcher.ts, M1)

The official legacy search (draw date lists and number search) only answers POST. Lane A uses
its own `FormPoster` (`packages/ingest/src/bonds/form-post.ts`) with the same politeness rules.
Optional: add a `post(url, form)` method to `Fetcher` and switch `FormPoster` callers to it.

## 5. Self-hosted OCR and PDF assets (CSP, PLAN sections 7 and 11)

The checker's "read numbers from a photo or PDF" path loads `tesseract.js` and `pdfjs-dist` only
when a file is chosen. tesseract.js fetches its worker, core and English data from its default
CDN, which the planned CSP (`connect-src 'self'`) blocks. Copy the tesseract worker, core and
`eng.traineddata` into `apps/web/public/vendor/tesseract/` and set `TESSERACT_PATHS` in
`apps/web/src/features/bonds/ocr.ts` (one constant). The pdf.js worker is bundled with
`new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` and needs nothing else.
Manual entry always works, so the feature degrades gracefully until then.

## 6. Environment (`apps/web/src/platform/env.ts`, PLAN section 5.4)

- `RATE_LIMIT_SECRET` (optional, 32+ random bytes): HMAC key for the `rate_limits` keys of
  `POST /bonds/check`. Without it the limiter falls back to `WALLET_PEPPER`, then `CRON_SECRET`.
  Add it to the env schema and to the owner's list.
- `BONDS_DATA=fixtures` (development and end to end tests only, ignored in production): serves the
  recorded official documents without a database.

## 7. Sitemap and navigation (Lane D)

- Bond URLs for `sitemap.ts`: `/{locale}/prize-bonds`, `/{locale}/prize-bonds/{slug}` for every
  denomination (`denominationSlug` in `apps/web/src/features/bonds/labels.ts`: `750`,
  `premium-40000`), `/{locale}/prize-bonds/{slug}/{drawNumber}` for every draw with results
  (`drawsOfDenomination` in `@bondcheck/db/queries/bonds`), `/{locale}/prize-bonds/schedule/{year}`
  (2000 to next year), `/{locale}/prize-bonds/check` and `/{locale}/prize-bonds/coverage`.
- The home page tiles can use `GET /api/v1/bonds/latest` or `latestDraws` and link to
  `/prize-bonds/{slug}/{drawNumber}`.
- The bond pages use the M1 UI primitives with their frozen props and the `bonds` namespace only.

## 8. Wallet chaining (Lane C request 3)

Done in Lane A's files: `apps/web/src/features/bonds/jobs.ts` runs `wallet-notify` right after a
bond job commits results, when Lane C's `walletJobs["wallet-notify"]` exists. No `ingest.yml`
change is needed for it. Lane C may still add the `wallet-notify` daily net to `vercel.json`.

## 9. Markets schedules

`.github/workflows/ingest.yml` holds only the bond schedules. Lane B's market schedules belong in
their own `ingest-markets.yml` (PLAN section 14, Lane B).

## 10. `legacy_draw_schedule` (migration 0000)

Not imported: its draw numbers disagree with the official files (for example the Rs 100 draw of
15 May 2026 is draw 54 in the official file and 48 in that table). The calendar comes from the
official date lists and the prizeinfo.net schedules. It can be dropped together with
`legacy_winners` in M-F.

## 11. Owner actions

1. After `pnpm db:migrate`, run the backfill as a dry run first (GitHub Actions "Backfill (prize
   bonds)" with `dry_run` checked, or locally
   `pnpm --filter @bondcheck/ingest backfill:bonds --dry-run --coverage`), review the coverage
   artifact, then run it for real. It needs `DATABASE_URL`; it fetches about 200 official files
   at one request every 2 seconds and takes roughly 15 to 30 minutes.
2. Set `APP_BASE_URL` and `CRON_SECRET` as GitHub Actions secrets for `ingest.yml`, and
   `DATABASE_URL` for `backfill.yml`.
3. Email prizeinfo.net and the pkprizebond.com operators about attribution and permission
   (PLAN section 15 item 6); both are credited on the coverage page.

## 12. `.gitignore` hides the coverage route and page

The `coverage/` pattern (meant for test coverage output) also matches
`apps/web/src/app/api/v1/bonds/coverage/route.ts` and
`apps/web/src/app/[locale]/prize-bonds/coverage/page.tsx`. Lane A force-added both files
(`git add -f`). Anchor the pattern to test output folders (for example `/coverage/` and
`packages/*/coverage/`), or add `!**/src/app/**/coverage/` after it.
