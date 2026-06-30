# BondCheck

BondCheck is a Pakistan prize bond and markets service: every draw result with its sources, a private bond wallet that needs no sign-up, and gold, silver and currency rates with history. It ships as a fast, installable website in English and Urdu and as an Android app built from the same repository.

## Features

- **Prize bonds.** Results for every denomination (Rs 100 to Rs 40,000 and the premium bonds) from 2000 to today, each draw with its prize table, first and second prize numbers, the full searchable list, a text download, its source documents and a status (verified, published or under review). A checker takes up to 1,000 numbers or ranges at once and can read numbers from a photo or PDF on the device. A public coverage report shows which years and denominations are complete.
- **My bonds.** An anonymous wallet per person: add bonds by typing, pasting, ranges, spreadsheet import or scanning; every bond is checked against every past draw and against each new draw; wins, near misses, unclaimed prize reminders and draw day notifications. A sync code moves the wallet to another device. Nothing identifies the person and the wallet can be deleted in one step.
- **Markets.** Gold per tola and 10 grams at 24K, 22K, 21K and 18K for Pakistan and ten countries, silver, platinum and palladium, the rupee's interbank and open market rates, a converter and charts with an accessible table alternative. Every number says whether it is reported by an association or estimated from spot prices, and names its source.
- **For everyone.** WCAG 2.2 AA in both languages, right to left Urdu with Nastaliq type, light and dark themes, works offline after the first visit, installable as an app, structured data and sitemaps for search.
- **Android app.** The same checker, results, wallet and rates, with camera scanning, local draw reminders and in-app updates, distributed from the website's download page.

## Architecture

```
apps/web         Next.js 16 (App Router), pages under app/[locale], JSON API under app/api/v1
apps/mobile      Expo (Expo Router) Android app, same /api/v1 contracts
packages/shared  zod contracts, typed ApiClient, units, bond and wallet helpers
packages/db      Drizzle schema, SQL migrations, query modules, PGlite test harness
packages/ingest  polite fetcher, parsers, validation, reconciliation and the ingestion jobs
```

- **One contract, two clients.** Every request and response has a zod schema in `packages/shared`; the website, the API handlers and the Android app all use it.
- **Static first.** Public pages are statically generated and revalidated by cache tag after each ingestion run; only the checker, the wallet and the release downloads are dynamic.
- **Ingestion.** Jobs follow discover, fetch, parse, validate, reconcile, commit. They are idempotent, resumable from a cursor and rate limited per host. Every fetched document is stored by SHA-256 and linked to the draws it produced. Schedulers (GitHub Actions for frequency, Vercel Cron as a daily safety net, Cloudflare Cron later) all call the same authenticated endpoint, `/api/v1/cron/<job>`.
- **Privacy.** Wallets are a random id and a 256-bit token stored as an HMAC; sync codes are hashed the same way. No accounts, no fingerprinting, no IP or location storage; rate limits use keyed hashes.
- **Portable hosting.** Hosting-specific code lives only in `apps/web/src/platform`, and the app builds for Cloudflare Workers with OpenNext as well as for Vercel.

The full design is in `docs/PLAN.md`, with decisions recorded in `docs/adr/`.

## Development

Requirements: Node 22 and Bun 1.3.

```
source ~/.nvm/nvm.sh && nvm use 22
bun install
bun run dev                     # website on http://localhost:3000
bun run --filter "*" lint && bun run --filter "*" typecheck && bun run --filter "*" test && bun run --cwd apps/web build
```

Every environment variable is optional during development (`apps/web/.env.example` lists them); without a database the pages show a friendly "data unavailable" state, and the end to end suites run on recorded data. Tests never touch a real database: they use an in-memory PGlite with the real migrations. See `docs/DEVELOPMENT.md` for the conventions and the end to end suites, and `docs/MOBILE_RELEASE.md` for the Android app.

## Data sources and attribution

| Data | Source | Role |
|---|---|---|
| Prize bond results, schedules, past draw dates | National Savings Pakistan (savings.gov.pk) | Primary, official files |
| Historical full lists 2000 to 2023 | pkprizebond.com (archived snapshot) | Fills gaps where no official file exists |
| First and second prize records, draw numbers, cities | prizeinfo.net | Cross-checking |
| Metal spot prices | gold-api.com (fallback MetalpriceAPI) | Gold, silver, platinum, palladium |
| Reference exchange rates | ExchangeRate-API ("Rates By Exchange Rate API") | Daily rates |
| Historical exchange rates | Free Currency Exchange Rates API by Fawaz Ahmed (CC0) | History |
| Rupee interbank rates | State Bank of Pakistan | Interbank |
| Rupee open market rates | Forex Association of Pakistan (forex.pk) | Open market |
| Pakistan gold rates | All Pakistan Sarafa Gems and Jewellers Association, as reported by the Associated Press of Pakistan | Reported local rates |

Crawlers identify themselves (`BondCheckBot/1.0`), fetch at most one request every two seconds per host, never re-download unchanged documents and respect `robots.txt`. The website's "Data sources" page carries the credits each licence asks for, and the coverage page explains how each draw was verified.

## Deployment

**Vercel (current).** Import the repository and set the project's **Root Directory to `apps/web`**; the framework preset is Next.js and the build command is the default (`bun run build`, which also copies the self-hosted scanner assets). `apps/web/vercel.json` declares the daily cron safety net. Set the environment variables from `docs/OWNER_SETUP.md`, apply the database migrations and run the backfills once. Vercel Web Analytics and Speed Insights are wired through `apps/web/src/platform/analytics.tsx` and need only to be enabled in the Vercel dashboard.

**Cloudflare (future).** The app avoids edge-only runtimes and keeps hosting code behind adapters so it can move to Cloudflare Workers with OpenNext (`@opennextjs/cloudflare`). CI already runs the OpenNext build as a non-blocking job. The move needs an R2 incremental cache and a D1 or Durable Object tag cache for `revalidateTag`, a Cron Trigger calling `/api/v1/cron/<job>`, and a Cloudflare Web Analytics adapter (PLAN section 13).

**Android.** Pushing a `v*` tag builds the APK in GitHub Actions (signed when the keystore secrets are set) and publishes it as a GitHub Release; the website serves it at `/download` (`docs/MOBILE_RELEASE.md`).

## Documentation

- `docs/OWNER_SETUP.md`: every secret, variable and one-time action needed to run production
- `docs/DEVELOPMENT.md`: conventions, checks and end to end suites
- `docs/PLAN.md` and `docs/adr/`: architecture and decisions
- `docs/COVERAGE.md`: prize bond coverage report
- `docs/MOBILE_RELEASE.md`: Android builds, signing and releases
- `SECURITY.md`: how to report a vulnerability, and the security model
- `CHANGELOG.md`: release notes

## Licence

Proprietary. Copyright (c) 2026 Muhammad Wasif Malik. All rights reserved. See `LICENSE`.
