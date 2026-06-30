# Owner setup for production

Everything the repository owner sets or does once to run BondCheck 1.0.0 in production. Nothing here can be done from the code; each step names where it happens. Do them in order.

## 1. Vercel project

1. In the Vercel project settings, set **Root Directory** to `apps/web` (General, Root Directory). Keep "Include files outside the root directory" enabled so the workspace packages build. Framework preset: Next.js. Install and build commands: defaults.
2. Enable **Web Analytics** (and optionally **Speed Insights**) in the project's Analytics tab. They are cookieless and already wired in `apps/web/src/platform/analytics.tsx`.
3. Add a **Firewall** rate limit rule for `/api/v1/releases/download/*` (for example 30 requests per minute per IP) and, if desired, for `/api/v1/bonds/check` and `/api/v1/wallets/restore`. The app has its own database-backed limits; the firewall is the outer layer (PLAN section 11).
4. Point the production domain at the project and use that origin as `APP_BASE_URL` below.

## 2. Environment variables (Vercel, Production and Preview)

Every variable is optional for the build. `apps/web/.env.example` documents the same list.

| Name | Required for | How to create |
|---|---|---|
| `DATABASE_URL` | All data pages and APIs | Neon pooled connection string |
| `APP_BASE_URL` | Canonical URLs, hreflang, sitemap, Open Graph, download QR code | The production origin, e.g. `https://bondcheck.pk` |
| `CRON_SECRET` | `/api/v1/cron/*` (Vercel Cron sends it automatically) | `openssl rand -base64 32` |
| `RATE_LIMIT_SECRET` | Keyed hashes in rate limit keys | `openssl rand -base64 32` (falls back to `WALLET_PEPPER`, then `CRON_SECRET`) |
| `WALLET_PEPPER` | The wallet (answers 503 without it) | `openssl rand -base64 32`. **Set once, never rotate**: rotating invalidates every wallet token and sync code. Keep a copy in a password manager |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push win alerts | `bunx web-push generate-vapid-keys`; subject `mailto:<support address>` |
| `GITHUB_RELEASES_TOKEN` | `/download` and in-app updates | Fine-grained GitHub token, this repository only, permission Contents: read-only. Website host only, never a GitHub secret |
| `GITHUB_RELEASES_REPO` | Optional | `owner/repo` if releases move (default `Wosmos/bondcrapo`) |
| `METALS_FALLBACK_API_KEY` | Optional metals fallback | Free MetalpriceAPI key |
| `MARKETS_ALLOW_FREEGOLDAPI` | Optional | Set `1` only after the FreeGoldAPI licence check in step 7 |
| `ANALYTICS_PROVIDER` | Optional | `none` disables analytics (read at build time) |

## 3. GitHub repository secrets and variables

Settings, Secrets and variables, Actions.

| Kind | Name | Used by |
|---|---|---|
| Secret | `APP_BASE_URL` | `ingest.yml`, `ingest-markets.yml`, `backfill.yml` (crawler user agent) |
| Secret | `CRON_SECRET` | `ingest.yml`, `ingest-markets.yml` (same value as on Vercel) |
| Secret | `DATABASE_URL` | `backfill.yml`, the market history backfill in `ingest-markets.yml` |
| Secret | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | `mobile-release.yml` (step 6) |
| Variable | `BONDCHECK_SITE_URL` | `mobile-release.yml`: the origin baked into the Android app |
| Variable | `BONDCHECK_MIN_SUPPORTED_VERSION_CODE` | Optional; forces older app builds to update |

Enable Dependabot alerts and security updates for the repository (Settings, Code security).

## 4. Database migration

The migrations in `packages/db/migrations` are reviewed but have never been applied to production. `0000_foundation` renames `winners` to `legacy_winners`, creates the new tables and drops the unused tables listed in `docs/DATA_AUDIT.md`; `0001_wallet_bond_lookup` adds one index.

1. Create a Neon branch from production and apply there first:
   `DATABASE_URL=<branch url> bun run db:migrate`
2. Check the branch (row count of `legacy_winners` equals the old `winners`, the app works against it with a preview deployment).
3. Apply to production: `DATABASE_URL=<production url> bun run db:migrate`.

## 5. Backfills (once, after the migration)

1. **Prize bonds.** Run the GitHub Actions workflow "Backfill (prize bonds)" with `dry_run` checked, review the coverage artifact, then run it again unchecked. Locally: `bun run --cwd packages/ingest backfill:bonds --dry-run --coverage`, then without `--dry-run`. It fetches about 200 official files at one request every two seconds (15 to 30 minutes) and is resumable.
2. **Markets history.** Run the `history-backfill` choice of the "Ingest markets" workflow, or `bun run --cwd packages/ingest backfill:markets --from 2024-03-02`.
3. Regenerate the coverage report with `bun run --cwd packages/ingest coverage:bonds` and commit `docs/COVERAGE.md`.
4. **Follow-up: drop `legacy_winners`.** Release 1.0.0 keeps the legacy table. Once the production coverage report shows every legacy draw represented or explicitly rejected, add a migration that drops `legacy_winners` and `legacy_draw_schedule`, review it and apply it as in step 4.

## 6. Android signing and the first release

1. Create the release keystore once (`docs/MOBILE_RELEASE.md`, Signing), keep two offline copies and set the four `ANDROID_*` secrets. Without it releases are published as unsigned prereleases that the website does not offer.
2. Push the tag: `git push origin master v1.0.0`. The "Mobile release" workflow builds the APK and creates the GitHub Release with `latest.json` and `SHA256SUMS.txt`; `/download` shows it within five minutes.

## 7. Content, licences and permissions

1. **Urdu review.** A native speaker reviews `apps/web/messages/ur/*.json` (Privacy and Terms first) and `apps/mobile/src/i18n/messages/ur.json` (ADR 0005). After changing `common.json`, run `bun run --cwd apps/mobile messages`.
2. **Contact address.** Add a support email for data requests to the Privacy and Terms pages (`apps/web/messages/*/common.json`) and as `VAPID_SUBJECT`.
3. **Permission emails.** Write to the operators of prizeinfo.net and pkprizebond.com about attributed reuse of their compilations, and courtesy emails to Forex Association of Pakistan (forex.pk) and the Associated Press of Pakistan about the reported rates. Both bond sites are credited on the coverage and data sources pages.
4. **FreeGoldAPI licence.** Confirm the licence of the monthly gold history before 2024; only then set `MARKETS_ALLOW_FREEGOLDAPI=1` and run the `--gold-monthly` backfill.
5. **India import levy.** Review the levy in `packages/ingest/src/markets/countries.ts` (6%) whenever the Union Budget changes it.
6. **1999 draws.** No digital source exists; decide whether to source newspaper archives manually.

## 8. After launch

- Watch the Actions tab: "Ingest (prize bonds)" and "Ingest markets" run on schedules and fail loudly when a source changes.
- `GET /api/v1/health` reports the database and the last successful run per job.
- Lighthouse CI and the OpenNext Cloudflare build run in CI as non-blocking jobs; review their reports before larger releases.
