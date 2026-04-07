# BondCheck rebuild plan

Status: approved for implementation. Author: architecture pass, 2026-10-15.
Audience: implementers (one implementer per lane, each in its own git worktree and branch).

Read first: `docs/DATA_AUDIT.md` (what the current DB holds and why it must be rebuilt) and the ADRs in `docs/adr/`.

---

## 0. Product summary

"HamariWeb finance, but better" for Pakistan, as one product with a web app and an Android app:

1. **Prize bonds**: every draw from as early as any source allows (official data reaches back to 2012, secondary sources to January 2000, 1999 is best effort) to today, every denomination, with provenance, cross-validation and a public coverage report. Ingestion runs on draw days and re-verifies recent draws.
2. **Personal tracking without login**: an anonymous wallet per person (bonds owned, all-time check against every draw, win history, near misses, draw reminders, notifications), portable through a sync code, upgradable to sign-in later.
3. **Markets**: gold, silver, platinum, palladium in major currencies; local retail rates per country (Pakistan per tola and 10 g at 24K/22K/21K/18K, Gulf, UK, US, India); PKR interbank vs open market; stored history and charts.
4. Accessibility (WCAG 2.2 AA), English and Urdu (RTL), fast on low-end Android, PWA and offline, SEO first.
5. Vercel now, Cloudflare (OpenNext) later, without rewrites.
6. Expo Android app in the same repo, built in GitHub Actions without EAS cloud, distributed through the website.

---

## 1. Target architecture

```
                         +-------------------------------+
  Browsers (PWA, en/ur)  |        apps/web (Next.js 16)  |   Android (apps/mobile, Expo)
  ---------------------> |  app/[locale]/...  SSG/ISR    | <-------------------------+
                         |  app/api/v1/...    JSON API   |   same /api/v1 contracts  |
                         |  app/api/v1/cron/[job]        |   (packages/shared zod)   |
                         +---------------+---------------+                           |
                                         |                                           |
              +--------------------------+---------------------------+               |
              |                          |                           |               |
   packages/shared (zod, types,   packages/db (Drizzle schema,   packages/ingest (pure TS jobs:
   API client, bond math,         migrations, query modules)     fetch -> parse -> validate ->
   units, i18n keys)                     |                       reconcile -> upsert)
                                         |                           ^        ^
                                         v                           |        |
                               Neon Postgres (HTTP driver)           |        |
                                                                     |        |
   Schedulers (all call the same HTTP endpoint with CRON_SECRET):    |        |
     Vercel Cron (daily safety net) ---- GET /api/v1/cron/<job> -----+        |
     GitHub Actions schedule (frequent) - POST /api/v1/cron/<job> ---+        |
     Cloudflare Cron Trigger (later) ---- scheduled() -> same handler +       |
   Backfill: `pnpm ingest:backfill` CLI (GitHub Actions workflow_dispatch or local) --+

   Release assets: GitHub Release (private, canonical) + public object store
   (Cloudflare R2 bucket, `latest.json` manifest) -> website /download and in-app update prompt.
```

Principles:

- **Core logic is runtime-agnostic.** `packages/ingest` and `packages/db` use only `fetch`, Web Crypto, and the Neon HTTP driver. No `@vercel/*` import outside `apps/web/src/platform/`.
- **One contract, two clients.** Every API request and response has a zod schema in `packages/shared`; web and mobile both consume it through a typed client.
- **Static first.** Public pages are statically generated and revalidated by tag after ingestion. Only wallet and check endpoints are dynamic.
- **Provenance everywhere.** Every published draw links to the source documents (URL, fetch time, sha256) it was built from.

---

## 2. Repo layout after cleanup (decision: pnpm workspace monorepo, see ADR 0002)

```
bondcrapo/
  apps/
    web/                     Next.js 16 app (moved from bondcheck-next/)
      src/app/[locale]/...   pages (en, ur)
      src/app/api/v1/...     JSON API
      src/features/<area>/   bonds | markets | wallet | shell | download (lane-owned)
      src/components/ui/     design-system primitives (stable props, Lane D owns internals)
      src/platform/          vercel/cloudflare adapters (analytics, waitUntil, env)
      src/i18n/              next-intl config
      messages/{en,ur}/<namespace>.json   one file per lane namespace
      public/                icons, manifest assets, self-hosted tesseract data
    mobile/                  Expo SDK app (Expo Router), Android first
  packages/
    shared/                  zod schemas, types, API client, bond/units math, constants
    db/                      Drizzle schema, migrations, query modules, PGlite test harness
    ingest/                  ingestion jobs, parsers, fixtures, CLI entry points
  scripts/                   version.mjs, coverage report, misc
  docs/                      PLAN.md, DATA_AUDIT.md, COVERAGE.md, adr/
  .github/workflows/         ci.yml, ingest.yml (schedules), backfill.yml, mobile-release.yml
  pnpm-workspace.yaml, package.json (root scripts), tsconfig.base.json, .nvmrc (22), LICENSE
```

Why not a single app at root: the Expo app is in scope and must share zod contracts and bond math; the ingestion code must run outside Next (CLI backfill, GitHub Actions, future Cloudflare Worker). Three small packages keep those boundaries honest and give parallel lanes disjoint directories.

Tooling: Node 22 LTS, pnpm 10 via Corepack (`packageManager` field), TypeScript strict, exact-pinned versions (`save-exact=true` in `.npmrc`), ESLint 9 flat config, Vitest, Playwright + `@axe-core/playwright`, Prettier. Note: the owner machine currently has bun but no node or pnpm; implementers install Node 22 and run `corepack enable`.

---

## 3. Data model (Drizzle, `packages/db/src/schema/*.ts`)

All money in PKR is `bigint` rupees (mode number is safe below 2^53). Market prices use `numeric(20,8)` with string mode, converted with a decimal helper in `packages/shared`. Timestamps are `timestamptz`. Dates of draws are `date`.

### 3.1 Prize bonds

```ts
// denominations: one row per instrument (bearer and premium are distinct)
denominations {
  code text pk                    // '100','200','750','1500','7500','15000','25000','40000','25000P','40000P', plus legacy '1000','5000','10000' if sourced
  faceValue integer not null
  kind text not null              // 'bearer' | 'premium_registered'
  status text not null            // 'active' | 'discontinued'
  introducedOn date, discontinuedOn date, encashmentDeadline date
  drawsPerYear smallint           // 4 for all current ones
  notesEn text, notesUr text
}

prize_structures {                // reference table, used for validation and for draws whose file lacks amounts
  id serial pk
  denominationCode text fk
  effectiveFrom date not null, effectiveTo date null
  tier smallint not null          // 1, 2, 3
  amountPkr bigint not null
  winnersCount integer not null
  sourceUrl text not null
  unique(denominationCode, effectiveFrom, tier)
}

draws {
  id serial pk
  denominationCode text fk not null
  drawNumber integer null         // null allowed only until reconciled
  drawDate date not null
  city text
  status text not null            // 'scheduled' | 'published' | 'verified' | 'disputed'
  completeness text not null      // 'none' | 'top' (1st+2nd only) | 'full'
  resultChecksum text             // sha256 of canonical "tier:number\n" sorted list
  publishedAt timestamptz, verifiedAt timestamptz, updatedAt timestamptz
  unique(denominationCode, drawDate)
  unique(denominationCode, drawNumber)   // partial: where drawNumber is not null
}

draw_prizes {                     // per-draw prize table, parsed from the result document header
  drawId integer fk, tier smallint, amountPkr bigint, winnersCount integer
  pk(drawId, tier)
}

draw_results {                    // the big table (~1.5M rows)
  drawId integer fk not null
  bondNumber integer not null     // 0..999999, always rendered lpad 6
  tier smallint not null
  pk(drawId, bondNumber)
  index(bondNumber)               // the check query
}

source_documents {                // raw fetched files, content-addressed
  sha256 text pk
  source text not null            // 'savings_gov_pk' | 'savings_gov_pk_legacy' | 'pkprizebond_com' | 'prizeinfo_net' | 'legacy_db_snapshot' | 'manual'
  url text not null
  fetchedAt timestamptz not null
  contentType text, bytes integer
  body text not null              // TXT/HTML as fetched (PDF stored as extracted text plus a flag)
}

draw_sources {                    // which documents contributed to a draw, and whether they agree
  drawId integer fk, documentSha256 text fk
  parserVersion text not null
  parsedCount integer not null
  checksum text                   // checksum of what this document alone yields
  role text not null              // 'primary' | 'corroborating' | 'conflicting'
  pk(drawId, documentSha256)
}
```

The legacy `winners` table is renamed to `legacy_winners` in Milestone 1 (no data loss) and becomes one input of the backfill (source `legacy_db_snapshot`). It is dropped only in Milestone F after the coverage report proves every legacy draw is represented or explicitly rejected.

### 3.2 Markets

```ts
metal_spot {                      // intraday ticks, kept 30 days
  metal text                      // 'XAU' | 'XAG' | 'XPT' | 'XPD'
  priceUsdPerOz numeric(20,8)
  observedAt timestamptz, source text
  pk(metal, source, observedAt)
}
metal_daily {                     // permanent history, one row per metal per day (UTC)
  metal text, date date
  openUsd, highUsd, lowUsd, closeUsd numeric(20,8)
  source text
  pk(metal, date)
}
fx_daily {                        // reference mid rates, base USD
  quote text, date date, rateFromUsd numeric(20,10), source text
  pk(quote, date)
}
fx_pkr_market {                   // Pakistan-specific: interbank vs open market
  currency text, date date
  kind text                       // 'interbank' | 'open_market'
  buy numeric(20,6), sell numeric(20,6)
  source text, observedAt timestamptz
  pk(currency, date, kind)
}
local_rates {                     // retail rates per country, reported or derived
  country text                    // ISO 3166-1 alpha-2
  city text not null default ''
  metal text, karat smallint      // karat 0 for silver/platinum
  unit text                       // 'tola' | '10g' | 'g' | 'oz' | 'kg'
  currency text
  price numeric(20,4)
  kind text                       // 'reported' (from an association) | 'derived' (spot x fx x purity + premium)
  source text, date date, observedAt timestamptz
  pk(country, city, metal, karat, unit, date, kind)
}
```

Units in `packages/shared/src/units.ts`: troy ounce = 31.1034768 g, tola = 11.6638038 g, purity 24K = 0.999 (stored as 24/24 for display, 0.999 for derivation), 22K = 22/24, 21K = 21/24, 18K = 18/24.

### 3.3 Operations

```ts
ingestion_runs {
  id uuid pk (v7)
  job text, trigger text          // 'vercel-cron' | 'gha' | 'cli' | 'cf-cron' | 'manual'
  startedAt, finishedAt timestamptz
  status text                     // 'running' | 'ok' | 'partial' | 'failed'
  cursor jsonb                    // resume point for chunked jobs
  stats jsonb, error text
}
ingestion_issues {
  id serial pk, runId uuid fk
  severity text                   // 'info' | 'warn' | 'error'
  entity text, entityKey text, message text, details jsonb
  resolvedAt timestamptz
}
rate_limits { key text, windowStart timestamptz, count integer, pk(key, windowStart) }
```

### 3.4 Wallets (anonymous identity, see ADR 0004)

```ts
wallets {
  id uuid pk (v7)
  tokenHash text not null           // sha256 of the 32-byte secret held by the client
  syncCodeHash text unique          // sha256 of the current human sync code, rotatable
  locale text, timezone text
  createdAt, lastSeenAt timestamptz
  userId text null                  // future sign-in link
}
wallet_bonds {
  walletId uuid fk on delete cascade
  denominationCode text fk
  bondNumber integer
  label text, addedAt timestamptz
  pk(walletId, denominationCode, bondNumber)
}
wallet_matches {
  walletId uuid fk on delete cascade
  drawId integer fk, bondNumber integer, tier smallint, amountPkr bigint
  matchedAt timestamptz, notifiedAt timestamptz, seenAt timestamptz
  pk(walletId, drawId, bondNumber)
}
push_subscriptions {
  id serial pk, walletId uuid fk on delete cascade
  platform text                     // 'webpush' | 'expo'
  endpoint text unique, keys jsonb, createdAt timestamptz
}
```

Dropped in Milestone 1: `devices`, `events` (they store IP, geolocation, battery level: unnecessary personal data). Dropped also: the unused out-of-band tables `analytics_daily`, `commodity_prices`, `exchange_rates`, `gold_prices`, `market_indices`, `news_articles`, `price_alerts`, `savings_rates` (created outside Drizzle; see DATA_AUDIT). `draw_schedule` (40 rows, source savings.gov.pk) is migrated into `draws` with status `scheduled`/`published` and then dropped.

Migrations: `drizzle-kit generate` produces SQL committed under `packages/db/migrations`; applied with `drizzle-kit migrate` (never `push` against production). The first migration must be written to be safe on the existing database (rename `winners`, create new tables, copy `draw_schedule`, then drop the listed tables).

---

## 4. Data sources (see ADR 0001)

### 4.1 Prize bonds

| Source | What it has | How far back | Role |
|---|---|---|---|
| savings.gov.pk denomination pages, e.g. https://savings.gov.pk/rs-750-prize-bond-draw | Official TXT + PDF per draw, header contains prize amounts and counts | about the 15 most recent draws per denomination (uploads from 2019 to 2026) | **Primary** for recent and new draws |
| savings.gov.pk legacy search, https://www.savings.gov.pk/latest/results.php (draw date list via `ajaxData.php`) | Official draw date lists per denomination including Premium 25000 and 40000, and number search | Oct 2012 onward (Rs 750: 57 draw dates; Rs 15000 to Apr 2021; Premium 40000 from Jun 2017) | **Catalog and spot verification** (draw dates; spot-check 1st/2nd winners). Not for bulk scraping |
| savings.gov.pk draw schedule (https://savings.gov.pk/prize-bonds/, https://savings.gov.pk/download-draws/) | Yearly schedule: date, city, draw number | current year | **Schedule** |
| pkprizebond.com | Full lists | Jan 2000 to Oct 2023 in our snapshot | Historical full lists. Site now answers 406/302 to scripted requests, so the **legacy DB snapshot (733,863 rows) is the practical source**. Do not hammer the site |
| prizeinfo.net (`/results/{denom}/`, `/{denom}-prize-bond-first-second-record/`, `/schedule/{year}/`) | 1st/2nd prize records with draw number and city, some full lists | about 2000 onward | **Corroboration** of top tiers, draw numbers and cities |
| Newspaper archives (Dawn, Jang), manual entry | Top prizes | 1999 and gaps | Manual CSV import with double entry, last resort |

Reality check on "1999 to now": no machine-readable source found for 1999. Full lists are achievable from January 2000 (legacy snapshot) for 200, 750, 1500, 7500, 40000; from 2003 for 15000; from 2012 for 25000; from 2013 for 100 (the data shows Rs 100 coverage starting Feb 2013 in both sources; confirm whether earlier Rs 100 draws existed). 1999 is listed as "no source" in the coverage report unless the owner provides newspaper scans.

Denomination list to seed (verify each date during Lane A, citing the NSS page):
- Active bearer: Rs 100, 200, 750, 1500.
- Discontinued bearer: Rs 7500, 15000, 25000, 40000 (bearer versions withdrawn 2019 to 2021; last draws in our data: 7500 Jan 2021, 15000 Mar 2021, 25000 and 40000 regular around 2020/2021).
- Premium registered: Rs 40000 Premium (since 2017, quarterly on the 10th of Mar/Jun/Sep/Dec), Rs 25000 Premium (newer). The legacy DB mixes premium 25000/40000 draws (Sept 2023 dates) into the bearer codes: Lane A must split them.
- Older withdrawn denominations (Rs 1000, 5000, 10000 and others referenced on prizeinfo.net) are seeded only if a source with lists is found.

Prize amounts: never assume a constant table. Parse amounts and counts from each document header (the official TXT says e.g. "First Prize of Rs.1,500,000/-", "Second Prize of Rs.500,000/- each", "Third Prize of Rs 9300/-"). `prize_structures` holds the known history for validation; when a historical document has no header, use the structure effective on that date and mark `draw_prizes` as inferred in `draw_sources`.

Legal: savings.gov.pk is a government site whose robots.txt allows everything except `/wp-admin/`; still fetch politely (1 request per 2 s, identifying User-Agent `BondCheckBot/1.0 (+https://<site>/about/data)`, cache by sha256, never re-download unchanged files). Secondary sites are private compilations: use them only to fill gaps and corroborate, attribute them on the coverage page, respect robots.txt, keep request volume minimal, and the owner should email both operators for permission (owner task). Winning numbers are facts, but database rights and ToS risk are reduced by preferring official files whenever they exist.

### 4.2 Markets (primary and fallback per dataset)

| Dataset | Primary | Fallback | Notes |
|---|---|---|---|
| Metal spot USD/oz (XAU, XAG, XPT, XPD) | gold-api.com (https://gold-api.com/docs), free, no key, unlimited real-time, history limited to 10 req/h | MetalpriceAPI (https://metalpriceapi.com/) or GoldAPI.io (https://www.goldapi.io/) free key | Build `metal_daily` from our own snapshots; history requests used only for the initial backfill, spread over hours |
| Long gold history | freegoldapi.com (https://freegoldapi.com/) | gold-api.com history endpoint | Licence must be confirmed before display (owner task); otherwise chart history starts at our first snapshot |
| FX reference (161 currencies incl. PKR) | ExchangeRate-API Open Access, https://open.er-api.com/v6/latest/USD (daily, attribution "Rates By Exchange Rate API" required, no redistribution: https://www.exchangerate-api.com/docs/free, https://www.exchangerate-api.com/terms) | fawazahmed0 currency-api via jsDelivr (https://github.com/fawazahmed0/exchange-api, CC0, has daily history) | Use the CC0 source for history backfill; Frankfurter/ECB (https://frankfurter.dev) for ECB currencies cross-check (no PKR) |
| PKR interbank | State Bank of Pakistan published rates (https://www.sbp.org.pk/ecodata/index2.asp) | ExchangeRate-API PKR mid | SBP is authoritative; parse the daily published page |
| PKR open market | Forex Association of Pakistan via https://www.forex.pk/ (buy/sell) | APP news wire daily "Rupee ... against Dollar" stories (https://www.app.com.pk/) | Scrape once or twice per business day, attribute FAP |
| Pakistan local gold (tola, 10 g; 24K, 22K) | APSGJA rates as reported daily by APP (https://www.app.com.pk/business/ e.g. "Gold prices remain unchanged at Rs437,836 per tola") | Derived: spot x USD/PKR open market x purity + calibrated premium | APSGJA has no feed; parse with strict regex and reject values outside +/-5% of derived. 21K and 18K are derived from 24K reported by purity |
| UAE, Saudi, Qatar, Kuwait, Oman, Bahrain, UK, US, India retail | Derived per country (spot x fx x purity, plus per-country premium config) labelled "estimated" | Reported sources added later per country (e.g. Dubai Gold and Jewellery Group daily rates, IBJA for India) after licence check | Every number shown with its `kind` badge |

### 4.3 Platform limits

- Vercel Hobby cron: at most once per day per job, timing within the hour, UTC (https://vercel.com/docs/cron-jobs/manage-cron-jobs). Therefore Vercel Cron is only the daily safety net; GitHub Actions `schedule` provides frequency (private repo: 2,000 free minutes per month; each trigger is a 10 s `curl`).
- Vercel Hobby function limits: keep every cron invocation under 60 s by chunking with `ingestion_runs.cursor`; response bodies under 4.5 MB (relevant for the APK: never stream binaries through functions).
- Vercel Web Analytics: page views on Hobby; custom events need Pro, so do not depend on them.
- OpenNext Cloudflare (https://opennext.js.org/cloudflare): Node runtime with `nodejs_compat`; do not use `export const runtime = "edge"`; Worker bundle limit (3 MiB free, 10 MiB paid, compressed) so keep tesseract, pdf.js, jspdf and xlsx client-side and dynamically imported; ISR and `revalidateTag` require the R2 incremental cache and a tag cache (D1 or Durable Object); Neon works through `@neondatabase/serverless` over HTTP (fetch) and WebSockets; images via `unoptimized` or Cloudflare Images loader.

---

## 5. Ingestion pipelines (`packages/ingest`)

Common shape for every job: `discover -> fetch -> parse -> validate -> reconcile -> commit -> report`.

- **Idempotent**: commits are upserts keyed by natural keys; a draw's results are replaced in one transaction only when the new checksum differs.
- **Resumable**: jobs process work items from a cursor stored in `ingestion_runs.cursor`; each HTTP invocation handles at most N items or 45 s, then returns `{ done: false }`; schedulers simply call again. The CLI loops until done.
- **Rate limited**: a per-host token bucket in the fetcher (default 1 req / 2 s, configurable per source), retries with exponential backoff and jitter on 429/5xx, `If-None-Match`/`If-Modified-Since` where supported, timeout 20 s.
- **Validated**: zod schemas for parser outputs plus domain checks (below). Failures create `ingestion_issues`; nothing invalid reaches published tables.
- **Provenance**: every fetched body is stored in `source_documents` by sha256; `draw_sources` links documents to draws with parser version and per-document checksum.

### 5.1 Prize bond validation rules

1. Every number is 6 digits; no duplicates within a draw; a number appears in exactly one tier.
2. Tier counts equal the counts in the document header, or `prize_structures` for that date (tolerance 0). Rs 200 has 5 second prizes; others have 3.
3. Exactly 1 first prize (unless the structure says otherwise).
4. Draw date matches the schedule or the official date list; draw numbers are monotonic per denomination by date.
5. Cross-source: tier 1 and tier 2 sets must match across all sources that have them; full-list checksums must match when two full sources exist.
6. Parser sanity: the generic "all 6-digit numbers in the file" approach of the old scraper is banned; parsers must locate tier sections by headers and ignore header numbers.

Reconciliation precedence: official TXT > official PDF > legacy snapshot > prizeinfo.net. Status: `verified` when at least two independent sources agree on tiers 1 and 2 (or the official file alone for draws after 2019); `disputed` when sources conflict (published with a visible notice, conflicting numbers listed in an issue); `published` otherwise.

### 5.2 Backfill (one-off, resumable)

`pnpm --filter @bondcheck/ingest backfill:bonds [--denomination 750] [--from 2000-01-01] [--dry-run]`

1. Seed `denominations` and `prize_structures`.
2. Catalog: official legacy date lists (13 POSTs total), official schedule pages, prizeinfo schedule pages, and distinct dates in `legacy_winners`. Normalise both legacy date formats (`DD-Mon-YYYY` and `D Month YYYY`) into one `date`.
3. Import legacy snapshot per draw as a candidate document (`legacy_db_snapshot`, body = canonical list) so it goes through the same validation.
4. Fetch official TXT/PDF for every draw they cover; prizeinfo record pages once per denomination.
5. Validate, reconcile, commit per draw. Write `docs/COVERAGE.md` and `GET /api/v1/bonds/coverage`: per denomination per year, expected draws vs `full`/`top`/`none`, verified vs disputed, source mix.

### 5.3 Scheduled jobs

| Job | Endpoint | GitHub Actions schedule (UTC) | Vercel daily net |
|---|---|---|---|
| `bonds-sync` (new draws: schedule says today or the last 3 days) | `/api/v1/cron/bonds-sync` | `0 7-15/2 * * *` (07:00 to 15:00 UTC, every 2 h, no-op on non-draw days) | `0 16 * * *` |
| `bonds-verify` (re-fetch draws from the last 120 days, recompute checksums) | `/api/v1/cron/bonds-verify` | `30 2 * * 1` | none |
| `bonds-schedule` (yearly schedule refresh) | `/api/v1/cron/bonds-schedule` | `0 3 * * 1` | none |
| `wallet-notify` (match new results against wallets, send push) | chained after `bonds-sync` commits, also `/api/v1/cron/wallet-notify` | after sync | included in `bonds-sync` |
| `metals-spot` | `/api/v1/cron/metals-spot` | `*/30 3-17 * * 1-5` and `0 */4 * * 0,6` | `0 12 * * *` |
| `fx-daily` (reference + SBP interbank) | `/api/v1/cron/fx-daily` | `15 0,12 * * *` | `0 13 * * *` |
| `pk-market` (FAP open market + APSGJA gold) | `/api/v1/cron/pk-market` | `0 7,10,13 * * 1-6` | `0 14 * * *` |
| `local-rates-derive` | chained after metals or fx jobs | | |
| `housekeeping` (prune ticks > 30 d, rate_limits > 1 d, roll `metal_daily`) | `/api/v1/cron/housekeeping` | `0 1 * * *` | |

Vercel Hobby allows only daily expressions, so `vercel.json` lists only the "Vercel daily net" column.

Cron auth: `Authorization: Bearer ${CRON_SECRET}` compared in constant time; **fail closed** when the secret is unset (the current code fails open). Vercel Cron sends this header automatically when `CRON_SECRET` is set. Endpoints accept GET (Vercel) and POST (others), return `{ runId, status, done, stats }`.

### 5.4 Secrets and env

| Name | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | web, ingest | Neon pooled URL |
| `CRON_SECRET` | web, GHA | 32+ random bytes |
| `APP_BASE_URL` | GHA ingest workflow | production URL |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | web push | generate once |
| `WALLET_PEPPER` | wallet hashing | HMAC key for token and sync code hashes |
| `METALS_FALLBACK_API_KEY` | ingest | optional (MetalpriceAPI or GoldAPI) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `DOWNLOADS_PUBLIC_BASE_URL` | mobile release CI, web /download | public APK hosting |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | mobile release CI | optional; unsigned build when absent |

`apps/web/src/env.ts` validates env with zod at startup (server-only), never exposing server keys to the client.

---

## 6. API surface (`/api/v1`, contracts in `packages/shared/src/api/*.ts`)

All responses JSON, `{ data, meta }` or `{ error: { code, message } }`. Errors use stable codes. Public GETs set `Cache-Control: public, s-maxage=<n>, stale-while-revalidate=<m>`.

Bonds (Lane A):
- `GET /bonds/denominations`
- `GET /bonds/draws?denomination=&year=&cursor=` list
- `GET /bonds/draws/{denomination}/{drawNumber}` summary, prize table, tier 1/2 numbers, sources, status
- `GET /bonds/draws/{denomination}/{drawNumber}/results?tier=3&page=` paginated full list; `.../results.txt` canonical text download (immutable once verified)
- `GET /bonds/latest` latest draw per denomination
- `GET /bonds/schedule?year=` upcoming and past draws
- `POST /bonds/check` body `{ items: [{ denomination?, number | from,to }] }` max 1,000 expanded numbers; returns wins with draw, tier, amount. Rate limited, never logged with numbers.
- `GET /bonds/coverage`

Markets (Lane B):
- `GET /markets/metals/latest?currency=PKR`
- `GET /markets/metals/history?metal=XAU&currency=USD&range=1m|6m|1y|5y|max`
- `GET /markets/local-rates?country=PK&date=`
- `GET /markets/fx/latest?base=USD`
- `GET /markets/fx/pkr?kind=open_market|interbank`
- `GET /markets/fx/history?base=USD&quote=PKR&range=`
- `GET /markets/convert?from=&to=&amount=` (pure computation from latest rates)

Wallet (Lane C), authenticated by wallet credentials (cookie `bc_wallet` httpOnly on web, `Authorization: Wallet <id>.<token>` on mobile):
- `POST /wallets` create, returns `{ walletId, token, syncCode }` (token and sync code shown once)
- `POST /wallets/restore` body `{ syncCode }` returns new token
- `POST /wallets/me/sync-code` rotate
- `GET /wallets/me`, `DELETE /wallets/me` (erase everything)
- `GET|PUT /wallets/me/bonds`, `DELETE /wallets/me/bonds/{denomination}/{number}`, `POST /wallets/me/bonds/import` (CSV/XLSX/OCR client-parsed list)
- `GET /wallets/me/matches`, `POST /wallets/me/matches/seen`
- `GET /wallets/me/analytics` (totals, wins by year and tier, near misses, expected value, upcoming draws for owned denominations)
- `POST|DELETE /wallets/me/push`

App and ops:
- `GET /app/latest` (mobile update manifest proxied from `latest.json`)
- `GET|POST /cron/{job}`
- `GET /health` (DB ping, last successful run per job, data freshness)

---

## 7. Rendering, caching, performance

- Pages under `app/[locale]` are server components; client components only for interactive islands (checker form, wallet, charts, scanner).
- Draw pages: `generateStaticParams` for the latest 8 draws per denomination, the rest on demand with long revalidation; tags `bonds`, `bonds:<denomination>`, `draw:<id>`. After a commit, the ingest job calls `revalidateTag` via an internal helper in `apps/web/src/platform/revalidate.ts`.
- Market pages: revalidate 15 min plus tag `markets` after each ingest.
- Charts: lightweight SVG (uPlot or hand-rolled) loaded lazily; no heavy chart library in the initial bundle.
- Budgets (CI-enforced with Lighthouse CI on a mid-tier mobile profile): LCP < 2.5 s on 4G, initial JS < 120 KB gzip on content pages, CLS < 0.05, INP < 200 ms.
- Heavy features (OCR, PDF, XLSX) are dynamic imports; tesseract language data self-hosted under `public/` and cached by the service worker on first use.

## 8. i18n and RTL (ADR 0005)

- `next-intl` with locales `en` (default) and `ur`; URLs `/en/...` and `/ur/...`, `/` redirects by `Accept-Language` then cookie; `hreflang` alternates and `x-default`.
- `<html lang dir>` set in `app/[locale]/layout.tsx`; Tailwind logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`); an ESLint rule (`no-restricted-syntax` on class strings or a Tailwind plugin check) forbids `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`.
- Fonts via `next/font`: Inter (Latin) and Noto Nastaliq Urdu (only loaded on `ur`, `display: swap`, line-height 1.9 for Urdu body).
- Bond numbers, prices and dates use Western digits in both locales (matches printed bonds); numbers wrapped in `<bdi dir="ltr">`. Currency and date formatting with `Intl` (`ur-PK`, `en-PK`).
- Messages split per namespace file (`common`, `bonds`, `markets`, `wallet`, `download`), each owned by one lane, so lanes never edit the same JSON file.

## 9. Accessibility checklist (WCAG 2.2 AA)

- Semantic landmarks, one `h1` per page, skip link, visible focus ring (3:1), focus not obscured by sticky headers.
- Colour contrast 4.5:1 text, 3:1 UI; never colour alone for win/loss or price direction (icon + text).
- Every form field labelled; errors announced via `aria-live="polite"` and linked with `aria-describedby`; checker results summary announced.
- Tables have `caption`, `scope` headers; large lists paginated, not infinite scroll.
- Target size at least 24 x 24 px (44 recommended on mobile); no gesture-only actions; respects `prefers-reduced-motion`.
- Charts have a data-table alternative and a text summary.
- OCR scanner has a manual-entry path; camera permission denial handled.
- Urdu: correct `lang`, screen reader tested with TalkBack on Android Chrome.
- Automated: `@axe-core/playwright` on every route in both locales (zero serious/critical); manual pass with keyboard and TalkBack before release.

## 10. Analytics and privacy

- `@vercel/analytics` (page views) behind `apps/web/src/platform/analytics.tsx`, switchable to Cloudflare Web Analytics by env. No custom events dependency, no fingerprinting, no IP or geolocation storage, no cookie banner needed for analytics (cookieless); the wallet cookie is strictly necessary.
- Remove `lib/fingerprint.ts`, `hooks/useTelemetry.ts`, `/api/track`, `/api/device/register`, the `devices` and `events` tables.
- Privacy page states exactly what is stored (wallet id, hashed token, bonds you add, push endpoint) and how to delete it.

## 11. Security

- Cron: constant-time secret check, fail closed. Delete `actions/scraper.ts` (server actions are public POST endpoints: today anyone can trigger scraping) and the unauthenticated `/admin` page; ops happen via CLI or authenticated cron endpoints.
- Input validation with zod on every route handler (body, query, params); bond numbers `^\d{6}$`, ranges capped.
- Rate limiting: `RateLimiter` interface in `packages/shared`; Postgres fixed-window implementation (`rate_limits` table) for `POST /bonds/check`, wallet create/restore (stricter: 5 per hour per IP hash for restore), push subscribe. The in-memory limiter in `lib/rate-limit.ts` is ineffective on serverless and is removed. Add Vercel Firewall rate-limit rules as an outer layer; on Cloudflare, use the Rate Limiting binding.
- Wallet secrets: 32-byte random token, stored as HMAC-SHA256 with `WALLET_PEPPER`; sync code 12 chars Crockford base32 (60 bits) with HMAC hash, constant-time compare, rotate on use.
- Headers (in `next.config.ts` `headers()`): `Content-Security-Policy` (`default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://va.vercel-scripts.com; worker-src 'self' blob:; img-src 'self' data: blob:; connect-src 'self' https://vitals.vercel-insights.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`), `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), geolocation=()`. Nonce-based CSP is rejected because it forces dynamic rendering and breaks ISR; revisit if needed.
- Dependencies: Dependabot or Renovate weekly, `pnpm audit` in CI, exact pins.

## 12. Testing strategy

- Unit (Vitest): parsers against committed fixtures of real documents (`packages/ingest/fixtures/<source>/...`), validation rules, units math, sync code generation, near-miss algorithm.
- DB integration (Vitest + PGlite with Drizzle migrations applied): query modules, upserts, reconciliation, idempotency (run twice, same checksum), resume from cursor. No test ever touches the production Neon database.
- Contract: every route handler test asserts the response parses with the shared zod schema.
- E2E (Playwright, Chromium mobile emulation): home, checker, draw page, wallet create/restore, gold page, both locales; axe checks.
- Performance: Lighthouse CI budgets on 5 key routes.
- Mobile: Jest + React Native Testing Library for screens; `expo-doctor` and a Gradle debug build in CI.
- CI (`.github/workflows/ci.yml`): install (frozen lockfile), lint, typecheck, unit, integration, build web, e2e; mobile job runs only when `apps/mobile/**` or `packages/shared/**` change.

## 13. Cloudflare portability notes

- No `runtime = "edge"`, no `@vercel/*` outside `src/platform`, no `next/after` assumptions without the adapter (`waitUntil` wrapper).
- Cron: `apps/web/src/server/cron.ts` exports `runJob(job, trigger)`; the route handler wraps it; on Cloudflare a `scheduled()` handler in the OpenNext worker entry (or a 20-line separate Worker) calls the same function or the HTTP endpoint.
- Caching: `revalidateTag` usage concentrated in `src/platform/revalidate.ts`; OpenNext needs R2 incremental cache and D1 tag cache configured in `open-next.config.ts` (added during the migration, not now).
- Keep server bundle small; verify with `pnpm dlx @opennextjs/cloudflare build` in a non-blocking CI job from Milestone F onward.

---

## 14. Milestones and parallel lanes

Execution model: **M1 runs alone first** on `master` (or branch `m1-foundation` merged before anything else). Then five lanes run **in parallel**, each in its own worktree and branch (`lane-a-bonds`, `lane-b-markets`, `lane-c-wallet`, `lane-d-shell`, `lane-e-mobile`), each lane executing its milestones in order. **M-F (integration and release)** runs last after all lanes merge.

Global rules for every lane:
- Only edit files you own (listed below). If you need a change in a file you do not own, write it down in `docs/lanes/<lane>-requests.md` (your own file) and stub around it; the integrator applies it in M-F.
- Contracts in `packages/shared/src/api/*` and the schema in `packages/db/src/schema/*` are frozen after M1. A lane may **add** new files in its own namespace (`packages/shared/src/api/<lane>-extra.ts`, `packages/db/src/schema/<lane>-extra.ts` plus a new migration file named `NNNN_<lane>_*.sql`), never edit M1 files. Migration numbering collisions are resolved at merge by the integrator (regenerate).
- `pnpm-lock.yaml` conflicts: lanes may add dependencies only to their own package or app; the integrator regenerates the lockfile on merge.
- Exact pins, no em dashes in docs, conventional commit messages, every milestone ends green on: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

### M1. Foundation: cleanup, monorepo, schema, contracts (shared, runs first)

Scope:
1. Delete `backend/`, `frontend/`, `AUTH_GUIDE.md`, `AUTH_SETUP.md`, root `readme.md`, `.agent/`, `.github/instructions/codacy.instructions.md`, `bondcheck-next/bun.lock`, `bondcheck-next/actions/`, `bondcheck-next/app/admin/`, `lib/fingerprint.ts`, `hooks/useTelemetry.ts`, `app/api/track`, `app/api/device`, `lib/rate-limit.ts`. Clean `.gitignore` of Python entries.
2. `git mv bondcheck-next apps/web`; move code into `apps/web/src/`; keep `AGENTS.md`/`CLAUDE.md` (Next 16 agent rules) at repo root and in `apps/web`.
3. Root workspace: `pnpm-workspace.yaml`, `package.json` (`packageManager: pnpm@10.x`, scripts `dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`), `.npmrc` (`save-exact=true`), `.nvmrc` (22), `tsconfig.base.json`, shared ESLint config, Prettier. Re-pin every dependency to the exact currently resolved version.
4. `packages/db`: full schema from section 3 (all tables, including those lanes will fill), first migration written to be safe on the live DB (rename `winners` to `legacy_winners`, copy `draw_schedule` into `draws`, drop listed tables), PGlite test harness `createTestDb()`. Do not run the migration against production in this milestone; the owner runs `pnpm db:migrate` after review.
5. `packages/shared`: zod contracts for every endpoint in section 6 (request, response, error), `ApiClient` (fetch-based, works in RN), units, `formatBondNumber`, denomination constants, `RateLimiter` interface, wallet credential header helpers.
6. `packages/ingest`: skeleton with `Fetcher` (rate limit, retries, sha256, UA), `Job` interface `{ name, run(ctx, cursor): Promise<{done, cursor, stats}> }`, `runJob` with `ingestion_runs` bookkeeping, CLI entry `src/cli.ts`.
7. `apps/web`: `[locale]` routing with next-intl (en, ur) skeleton, `src/platform/{analytics,revalidate,waitUntil,env}.ts`, minimal UI primitives with frozen props (`Button`, `Card`, `PageHeader`, `DataTable`, `Stat`, `Badge`, `EmptyState`, `Skeleton`), nav registry `src/features/registry.ts` importing `src/features/<area>/nav.ts` stubs for bonds, markets, wallet, download; route stubs returning 501 for every `/api/v1` endpoint (each in its lane's folder); cron dispatcher `/api/v1/cron/[job]` with fail-closed auth and a job registry `src/server/jobs.ts` importing per-lane `jobs.ts` stubs; message files per namespace.
8. CI workflow `ci.yml`; `vercel.json` with root directory note (Vercel project Root Directory must be changed to `apps/web` by the owner).
9. Keep the existing user-facing checker working against `legacy_winners` via a temporary adapter so production is never broken.

Files touched: whole repo. Acceptance: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; `rg -n "backend|frontend" -g '!docs/**'` finds no references; migration applies cleanly to a PGlite database seeded with the legacy table shapes (test); `curl /api/v1/cron/bonds-sync` without secret returns 401 even when `CRON_SECRET` is unset (test); every contract file exports request/response schemas.

### Lane A: prize bonds (owns `packages/ingest/src/bonds/**`, `packages/ingest/fixtures/bonds/**`, `packages/db/src/queries/bonds.ts`, `apps/web/src/app/api/v1/bonds/**`, `apps/web/src/features/bonds/**`, `apps/web/src/app/[locale]/prize-bonds/**`, `apps/web/messages/*/bonds.json`, `.github/workflows/ingest.yml`, `.github/workflows/backfill.yml`, `docs/COVERAGE.md`)
Must not touch: shell layout, UI primitives, wallet, markets, mobile, M1 schema/contract files.
Consumes: `draws`, `draw_results`, `draw_prizes`, `denominations`, `prize_structures`, `source_documents`, `draw_sources`, `ingestion_*` tables; bonds contracts; `Fetcher`, `Job`.

**A1. Parsers, validation and 2000-to-now backfill with coverage report.**
Scope: parsers for official TXT, official PDF (text extraction with `pdfjs-dist` in Node, fallback), official legacy date list, prizeinfo record and schedule pages, legacy snapshot importer; validation and reconciliation per section 5.1; denominations and prize structures seed (cite sources in seed file comments); backfill CLI and `backfill.yml` (workflow_dispatch, runs CLI with `DATABASE_URL` secret); coverage generator writing `docs/COVERAGE.md`.
Acceptance: fixture tests for each parser (at least 3 real documents per source, including Rs 200 with 5 second prizes and one premium draw); running backfill twice yields zero changes the second time (PGlite integration test with fixtures); coverage report lists every denomination and year 1999 to 2026 with full/top/none counts; no draw with conflicting top tiers is marked verified; the 17 multi-first-prize draws and 4 cross-source conflicts from DATA_AUDIT are each resolved or listed as disputed.
Commands: `pnpm --filter @bondcheck/ingest test`, `pnpm --filter @bondcheck/ingest backfill:bonds --dry-run --from 2024-01-01`.

**A2. Bond API, scheduled sync, public pages.**
Scope: implement all `/api/v1/bonds/*` handlers; jobs `bonds-sync`, `bonds-verify`, `bonds-schedule` registered in the lane's `jobs.ts`; tag revalidation; GitHub Actions schedules; pages: `/prize-bonds` hub, `/prize-bonds/[denomination]` (list of draws, next draw), `/prize-bonds/[denomination]/[drawNumber]` (result page with prize table, top numbers, searchable full list, download, sources and status badge), `/prize-bonds/schedule/[year]`, `/prize-bonds/check` (multi-number and range checker, OCR import kept as dynamic import), `/prize-bonds/coverage`; JSON-LD (`Dataset`, `BreadcrumbList`) and metadata.
Acceptance: contract tests for each endpoint; `POST /bonds/check` with 1,000 numbers answers < 300 ms on PGlite fixture data; cron job no-ops on non-draw days and ingests a fixture draw on draw day (mocked fetch); Playwright test checks a known winning fixture number; pages pass axe in en and ur.

### Lane B: markets (owns `packages/ingest/src/markets/**`, `packages/ingest/fixtures/markets/**`, `packages/db/src/queries/markets.ts`, `apps/web/src/app/api/v1/markets/**`, `apps/web/src/features/markets/**`, `apps/web/src/app/[locale]/{gold-rate,silver-rate,currency,metals}/**`, `apps/web/messages/*/markets.json`)
Must not touch: bonds, wallet, shell, mobile, M1 files. Adds its schedules to `ingest.yml` only via a request file (Lane A owns that workflow) or its own `ingest-markets.yml` (preferred).
Consumes: `metal_spot`, `metal_daily`, `fx_daily`, `fx_pkr_market`, `local_rates`, `ingestion_*`; markets contracts; units.

**B1. Market ingestion and API.**
Scope: providers with a common `PriceProvider` interface (gold-api.com, fallback key-based provider, ExchangeRate-API open, fawazahmed0 currency-api for history, SBP interbank parser, FAP open market parser, APP gold article parser); derivation engine for local rates per country (config file `markets/countries.ts` with currency, units, karats, premium, labels); jobs `metals-spot`, `fx-daily`, `pk-market`, `local-rates-derive`, `housekeeping`; one-off history backfill CLI (gold/silver daily since 2000 where licensed, FX daily since 2010); all `/api/v1/markets/*` endpoints; attribution strings in responses.
Acceptance: provider fixture tests; fallback test (primary returns 500, fallback used, run status `partial`); derivation math tests (e.g. 24K tola PKR from spot and rate within 0.01%); reported APSGJA value rejected when > 5% from derived (test); contract tests.

**B2. Market pages and charts.**
Scope: `/gold-rate` (Pakistan default, city selector), `/gold-rate/[country]` for PK, AE, SA, QA, KW, OM, BH, GB, US, IN; `/silver-rate`, `/metals/[metal]`; `/currency` (PKR open vs interbank table), `/currency/[pair]` (e.g. `usd-to-pkr`), converter; lazy SVG charts with table alternative; per-page metadata, JSON-LD, FAQ blocks for SEO; "estimated" vs "reported" badges and source attribution.
Acceptance: Playwright + axe on each page type in both locales; Lighthouse budgets met on `/gold-rate` and `/currency`; chart has accessible table alternative (test).

### Lane C: wallet and personal analytics (owns `packages/db/src/queries/wallet.ts`, `packages/shared/src/wallet/**` (new files only: near-miss, analytics math), `apps/web/src/app/api/v1/wallets/**`, `apps/web/src/features/wallet/**`, `apps/web/src/app/[locale]/my/**`, `apps/web/messages/*/wallet.json`, `apps/web/public/sw-push.js`)
Must not touch: bonds ingestion, markets, shell, mobile, M1 files.
Consumes: `wallets`, `wallet_bonds`, `wallet_matches`, `push_subscriptions`, `draws`, `draw_results` (read only, through its own queries), wallet contracts, `RateLimiter`.

**C1. Anonymous identity and wallet API.**
Scope: wallet create/restore/rotate/delete, credential middleware (cookie and header), bonds CRUD and import, matching engine (all-time check on add, incremental on new draws via `wallet-notify` job exported in the lane's `jobs.ts`), near-miss algorithm (same denomination, Hamming distance 1 or matching last 5 digits against tier 1 and 2), analytics endpoint, Web Push send (VAPID) with `push_subscriptions`.
Acceptance: unit tests for sync code entropy/format and HMAC hashing; integration test: create wallet, add 3 bonds, one matches a fixture draw, `wallet-notify` creates exactly one match and one push call (mocked); restore with sync code invalidates the old token; rate limit on restore enforced (test); `DELETE /wallets/me` removes all rows (test).

**C2. Wallet UI and analytics.**
Scope: `/my` dashboard (owned bonds, total face value, wins, unclaimed reminder, upcoming draws for owned denominations), `/my/bonds` (add single, range, paste, CSV/XLSX import, OCR scan reuse), `/my/wins`, `/my/near-misses`, `/my/settings` (sync code display and QR, restore, notifications toggle, export PDF/XLSX, delete wallet); local-first cache in IndexedDB for offline viewing; migration of existing IndexedDB history from the old app (`lib/history-db.ts`) into the wallet on first visit.
Acceptance: Playwright flow create, add, restore on a second browser context with sync code; offline view shows cached bonds; axe passes; keyboard-only flow works.

### Lane D: shell, i18n, accessibility, PWA, SEO (owns `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/app/[locale]/{about,privacy,terms}/**`, `apps/web/src/components/**`, `apps/web/src/i18n/**`, `apps/web/messages/*/common.json`, `apps/web/src/app/{manifest.ts,robots.ts,sitemap.ts,opengraph-image.tsx}`, `apps/web/src/app/sw.ts` or `public/sw.js` (except `sw-push.js`), `apps/web/src/styles/**`, `apps/web/proxy.ts`, Lighthouse CI config)
Must not touch: lane feature folders, API routes, packages.
Consumes: nav registry, message namespaces, UI primitive props (frozen).

**D1. Shell, design system, i18n and RTL.**
Scope: header, nav (from registry), footer, language switcher, theme (light/dark), primitives restyled (props unchanged), Urdu typography, logical-properties lint rule, `proxy.ts` locale negotiation, translation of `common` namespace, home/landing page (latest draws, gold and USD/PKR tiles via the shared client, CTA to checker and wallet).
Acceptance: axe zero serious issues on home in en and ur; visual snapshot tests in RTL; lint rule catches a planted `ml-4`; Lighthouse mobile performance >= 90 on home.

**D2. PWA, offline, SEO.**
Scope: Serwist (or a hand-written service worker) with precache of shell, runtime cache for draw pages and market JSON (stale-while-revalidate), offline fallback page, installability (manifest, maskable icons), `sitemap.ts` generating all draw, denomination, country and pair URLs in both locales (sitemap index if > 50,000), `robots.ts`, canonical and hreflang helpers exported for lanes, OG image template, About/Privacy/Terms pages, data attribution page.
Acceptance: Lighthouse PWA checks pass; offline reload of a visited draw page works (Playwright offline mode); sitemap validates and includes `ur` alternates.

### Lane E: mobile app and distribution (owns `apps/mobile/**`, `.github/workflows/mobile-release.yml`, `scripts/version.mjs`, `apps/web/src/app/[locale]/download/**`, `apps/web/src/app/api/v1/app/**`, `apps/web/src/features/download/**`, `apps/web/messages/*/download.json`, `docs/MOBILE_RELEASE.md`)
Must not touch: other lanes, M1 files.
Consumes: `packages/shared` contracts and `ApiClient`, wallet credential scheme.

**E1. Expo app.**
Scope: Expo SDK (latest stable at implementation time), Expo Router, screens: home, bond checker (with camera OCR via on-device ML Kit text recognition module or manual entry), draw results browser, my wallet (create/restore via sync code, credentials in `expo-secure-store`), gold and currency, settings (language with `I18nManager.forceRTL` for Urdu and reload), local notifications for upcoming draws of owned denominations (`expo-notifications` local scheduling only; remote push deferred, see ADR 0006), background refresh via `expo-background-task` to check new results on app open and periodically; in-app update prompt reading `GET /api/v1/app/latest` and opening the APK URL.
Acceptance: `pnpm --filter mobile test` (Jest RNTL) green; `npx expo-doctor` clean; `npx expo prebuild --platform android --clean && cd android && ./gradlew assembleDebug` succeeds locally or in CI; typecheck uses shared contracts (no duplicated types).

**E2. Mobile CI, versioning, downloads.**
Scope: `scripts/version.mjs <x.y.z>` updates root and all workspace `package.json` versions, `apps/mobile/app.json` `expo.version` and `android.versionCode = major*10000 + minor*100 + patch`, and fails CI if the tag does not equal the version (`--check`); `mobile-release.yml` on `v*` tags: setup Node 22, pnpm, Java 17, Android SDK, `expo prebuild --platform android --no-install`, Gradle `assembleRelease`; if `ANDROID_KEYSTORE_BASE64` exists decode it and sign via Gradle signing config injected by an Expo config plugin, else build unsigned and name the file `*-unsigned.apk` with a release note; compute sha256; create GitHub Release with the APK; upload APK and `latest.json` (`version`, `versionCode`, `url`, `sha256`, `minSupportedVersionCode`, `notes`) to the public R2 bucket; `/download` page (en, ur) with version, size, sha256, install instructions, QR code; `/api/v1/app/latest` reads `latest.json` with 5 min cache.
Acceptance: workflow lint (`actionlint`); dry-run job on a test tag in a fork or with `workflow_dispatch` input `dry_run: true` producing an unsigned APK artifact; `/download` renders with a fixture manifest; `version.mjs --check` fails on mismatch (test).

### M-F. Integration and release v1.0.0 (runs last, single implementer)

Scope: merge lanes in order D, A, B, C, E; regenerate lockfile and migration numbering; apply each `docs/lanes/*-requests.md`; security headers and CSP from section 11; analytics adapter wiring; remove the legacy adapter and drop `legacy_winners` once `docs/COVERAGE.md` confirms parity; README (product, architecture, dev setup, data sources and attribution), `LICENSE` (owner chooses: proprietary "All rights reserved" recommended since the repo is private; MIT only if open-sourcing), `SECURITY.md`, `CHANGELOG.md`; OpenNext Cloudflare build as a non-blocking CI job; final Lighthouse and axe sweep; `scripts/version.mjs 1.0.0`; tag `v1.0.0` (owner pushes).
Acceptance: full CI green; `pnpm build` and `pnpm dlx @opennextjs/cloudflare build` both succeed; Playwright suite green in both locales; no file references `bondcheck-next`, `devices`, `events`, `fingerprint`; security headers verified by an integration test hitting `next start`.

Milestone count: M1, A1, A2, B1, B2, C1, C2, D1, D2, E1, E2, M-F = 12.

---

## 15. Owner actions and blockers

1. Install Node 22 and Corepack on the dev machine (only bun exists today).
2. Change the Vercel project Root Directory to `apps/web` after M1 merges; set env vars from section 5.4; run `pnpm db:migrate` against Neon after reviewing the M1 migration (consider a Neon branch first).
3. Create a Cloudflare R2 bucket with public access (or a public `bondcheck-releases` GitHub repo as an alternative) and add the R2 secrets for APK distribution.
4. Optional Android signing keystore (secrets listed in 5.4). Without it, APKs ship unsigned and cannot be installed as updates over each other reliably; strongly recommended.
5. Optional paid or free-key metals fallback (MetalpriceAPI or GoldAPI) key.
6. Licence checks: freegoldapi.com history display; permission emails to prizeinfo.net and pkprizebond.com operators; decide on reported Gulf/India sources.
7. 1999 draws: no digital source found; decide whether to source newspaper archives manually.
