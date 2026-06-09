# Lane C (wallet) requests for the integrator

Changes Lane C needs in files it does not own. Each item says why and what exactly to do.

## 1. `apps/web/src/app/api/v1/routes.test.ts` (M1)

The test "unbuilt endpoints answer 501" calls every contract endpoint and expects 501. The wallet
endpoints are now implemented, so they answer 503 (no `WALLET_PEPPER` in the test environment)
or 401 instead. Skip implemented endpoints, for example:

```ts
const skip = new Set(["cron.get", "cron.post", "ops.health"]);
const implemented = (id: string) => id.startsWith("wallets.");
for (const e of all.filter((x) => !skip.has(x.id) && !implemented(x.id))) { ... }
```

Wallet handlers are covered by `apps/web/src/features/wallet/server/wallet-api.test.ts`, which
parses every response with the shared contract. Until this lands, this one M1 test fails on
the Lane C branch.

Note: the same test already fails on the M1 commit, because the `bonds.coverage` contract
(`GET /bonds/coverage`) has no route file at `apps/web/src/app/api/v1/bonds/coverage/route.ts`
(Lane A owns it). Both test cases stop at that missing file before reaching the wallet routes.

## 2. Migration journal (`packages/db/migrations/meta/_journal.json`)

Lane C added `0001_wallet_bond_lookup.sql` (one additive `CREATE INDEX IF NOT EXISTS` on
`wallet_bonds (denomination_code, bond_number)` for the `wallet-notify` join) and a journal entry
for it. No snapshot was generated. When regenerating migration numbering at merge, keep the
statement and renumber after the other lanes' migrations; its `when` must be greater than every
earlier entry so `drizzle-kit migrate` applies it on the live database.

## 3. Chain `wallet-notify` after `bonds-sync` (Lane A, `ingest.yml` and the bonds job)

PLAN section 5.3: `wallet-notify` runs after `bonds-sync` commits new results. Either:
- in `.github/workflows/ingest.yml`, after the `bonds-sync` curl, call
  `POST /api/v1/cron/wallet-notify` with the same `CRON_SECRET` header; or
- at the end of a `bonds-sync` run that committed a draw, call `runCronJob("wallet-notify", trigger)`.

The job is idempotent, so running it on every `bonds-sync` call, including no-op days, is safe.
Also add `{ "path": "/api/v1/cron/wallet-notify", "schedule": "30 16 * * *" }` to
`apps/web/vercel.json` as the daily safety net.

## 4. Service worker (Lane D)

The shell service worker should include the wallet push handlers:

```js
self.BONDCHECK_SHELL_SW = true;
importScripts("/sw-push.js");
```

Until a shell worker exists, the wallet registers `/sw-push.js` on its own at scope `/` when
the person turns notifications on; a later shell worker at the same scope replaces it and keeps
the push subscription. The shell worker must never cache `/api/v1/wallets/**` (responses are
`Cache-Control: private, no-store`).

## 5. Security headers and CSP (M-F, PLAN section 11)

- The bond scanner reuses the legacy approach: `pdfjs-dist` loads its worker from cdnjs and
  `tesseract.js` downloads its language data from its default CDN. With the planned CSP
  (`connect-src 'self'`, `worker-src 'self' blob:`) both must be self-hosted. Point
  `apps/web/src/features/wallet/client/files.ts` (and Lane A's checker) at the self-hosted paths
  once they exist under `public/`.
- Web Push needs no extra CSP entries (the browser talks to the push service, not the page).

## 6. Navigation and footer (Lane D)

`features/wallet/nav.ts` already registers `/my` as "My bonds". The privacy page should state
what the wallet stores (copy is in `messages/*/wallet.json` under `settings.privacy*`), and link
to `/my/settings` for export and deletion.

## 7. Environment (owner)

- `WALLET_PEPPER`: 32+ random bytes, set once and never rotated (rotation invalidates every
  wallet token and sync code). Without it the wallet API answers 503 with a clear message.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (base64url, uncompressed P-256 and the 32 byte scalar,
  the format `web-push generate-vapid-keys` prints) and `VAPID_SUBJECT` (`mailto:` address).
  Without them wins are still recorded and shown in the app; the notifications switch explains
  that notifications are not available yet.

## 8. Dependencies added to `apps/web`

`qrcode-generator` 2.0.4 (sync code QR, loaded on demand), `@neondatabase/serverless` 1.0.2
(only to point the driver at the local PGlite bridge in end-to-end tests; the production path
is unchanged), and dev dependencies `@playwright/test` 1.64.1, `@axe-core/playwright` 4.14.0
and `@electric-sql/pglite` 0.5.10. Lane D or E may add Playwright too; keep one version.

## 9. Rate limits behind carrier NAT

Restore is limited to 5 attempts per hour per hashed client address as ADR 0004 requires.
Many Pakistani mobile users share one carrier address, so a busy address can hit that limit.
Wallet creation is therefore allowed 60 times per hour per address. If restore support requests
show the same problem, add a challenge (for example a short proof of work) once the limit is
reached rather than raising the limit, so code guessing stays infeasible.
