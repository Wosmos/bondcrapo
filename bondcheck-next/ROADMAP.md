# BondCheck — Product Roadmap & Technical Guide

> Evolving from a prize bond checker into Pakistan's first unified personal finance dashboard.

---

## Table of Contents

1. [Vision & Why](#vision--why)
2. [Market Research (Real Numbers)](#market-research-real-numbers)
3. [Competitive Landscape](#competitive-landscape)
4. [Current Tech Stack](#current-tech-stack)
5. [Current Codebase Structure](#current-codebase-structure)
6. [Database Schema (All Tables)](#database-schema-all-tables)
7. [All API Endpoints](#all-api-endpoints)
8. [Cron Jobs](#cron-jobs)
9. [Free Data Sources](#free-data-sources)
10. [Phase 1: Prize Bond Dominance — DONE](#phase-1-prize-bond-dominance--done)
11. [Phase 2: Daily Market Pulse — TODO](#phase-2-daily-market-pulse--todo)
12. [Phase 3: National Savings Hub — TODO](#phase-3-national-savings-hub--todo)
13. [Phase 4: Islamic Finance Tools — TODO](#phase-4-islamic-finance-tools--todo)
14. [Phase 5: Tax & Government — TODO](#phase-5-tax--government--todo)
15. [Phase 6: Personal Finance Layer — TODO](#phase-6-personal-finance-layer--todo)
16. [Phase 7: Infra & Monetization — TODO](#phase-7-infra--monetization--todo)
17. [Phase 8: Community & Growth — TODO](#phase-8-community--growth--todo)
18. [Data Collection Strategy](#data-collection-strategy)
19. [Monetization Plan](#monetization-plan)
20. [Design System & Conventions](#design-system--conventions)
21. [Important Notes for Development](#important-notes-for-development)

---

## Vision & Why

BondCheck becomes Pakistan's personal finance super-app. Nobody in Pakistan combines prize bonds + gold + forex + savings + tax + Islamic finance + expense tracking in one place.

**The market is massive and underserved:**
- 7M+ National Savings investors through 376 CDNS branches
- 117M internet users (45.6% penetration)
- 194M mobile connections
- 47M Raast users
- 50.2% digital wallet penetration (was 10.5% in 2019)
- Top competitor Pakbond has 1M+ users with JUST a basic checker — no analytics, no financial tools, no web version

**Strategy:** Start from prize bond dominance (we already have the deepest database: ~960K records back to 2000), then expand concentrically into adjacent financial tools. Every feature brings users back more frequently and collects deeper data.

---

## Market Research (Real Numbers)

### Pakistani Prize Bond Market
- CDNS total portfolio: Rs. 3.4 trillion (~$12.1B USD) across 7M+ investors
- Prize bonds outstanding: ~Rs. 845B (~$3B USD)
- ~70,600 Pakistanis win a combined Rs. 1.6B in prize money annually
- Prize bond tax: 15% for filers, 30% for non-filers

### Active Denominations (as of 2026)

**Physical bearer bonds:**
| Denom | 1st Prize | 2nd Prize (count) | 3rd Prize (count) |
|-------|-----------|--------------------|--------------------|
| Rs. 100 | Rs. 700,000 | Rs. 200,000 (x3) | Rs. 1,000 (x1,199) |
| Rs. 200 | Rs. 750,000 | Rs. 250,000 (x5) | Rs. 1,250 (x2,394) |
| Rs. 750 | Rs. 1,500,000 | Rs. 500,000 (x3) | Rs. 9,300 (x1,696) |
| Rs. 1,500 | Rs. 3,000,000 | Rs. 1,000,000 (x3) | Rs. 18,500 (x1,696) |

**Premium registered bonds:**
| Denom | 1st Prize | 2nd Prize (count) | 3rd Prize (count) |
|-------|-----------|--------------------|--------------------|
| Rs. 25,000 | Rs. 30,000,000 (x2) | Rs. 10,000,000 (x5) | Rs. 300,000 (x700) |
| Rs. 40,000 | Rs. 80,000,000 | Rs. 30,000,000 (x3) | Rs. 500,000 (x660) |

**Digital registered bonds (launched 2025 — new, nobody tracks these yet):**
| Denom | Max Prize |
|-------|-----------|
| Rs. 500 | Rs. 2,000,000 |
| Rs. 1,000 | Rs. 4,000,000 |
| Rs. 5,000 | Rs. 20,000,000 |
| Rs. 10,000 | Rs. 40,000,000 |

### Key Policy Changes
- Bearer bonds (7500/15000/25000/40000) — DISCONTINUED. Final encashment deadline: Dec 31, 2024.
- Digital Prize Bonds launched 2025 via National Savings Mobile App — completely paperless, registered to CNIC, prizes auto-credited.
- Virtual Assets Act 2026 — crypto is now legally regulated in Pakistan.
- Pakistan is 3rd globally in crypto adoption (30-40M users).

### Fintech Landscape
- JazzCash: 48M registered users, Rs. 10.7T in transactions
- EasyPaisa: 2.7B transactions worth Rs. 9.5T in 2024 (~9% of GDP)
- Raast: 47M users, 1.1M merchants, Rs. 18.5T processed in Q2 FY26
- SadaPay/NayaPay: Growing neobanks targeting freelancers
- 81% of all digital transactions done via mobile apps
- NO app combines financial tools + investment tracking + savings management

### National Savings Certificate Rates (Jan 5, 2026)
| Scheme | Annual Rate | Notes |
|--------|------------|-------|
| Bahbood Savings | 12.48% | Widows, seniors, disabled only |
| Defence Savings | 11.08% | 10-year maturity |
| Special Savings | 10.20-11.00% | 3-year maturity |
| Regular Income | 10.56% | Monthly payout |
| Short Term (3M) | 10.32% | |
| Short Term (6M) | 10.36% | |
| Short Term (12M) | 10.68% | |
| SISA (Islamic) | 8.40% | Shariah-compliant savings |
| SITA (Islamic) | 10.80% | Shariah-compliant term |

### Ad Revenue Reality
- Google AdSense CPM for Pakistan: $0.11 (too low for primary revenue)
- Finance CPC in Pakistan: $0.10-$0.40
- 100K DAU with AdSense alone = ~$1,000/month
- Better: lead gen for banks ($1-5/lead), premium features, API licensing, affiliate deals

### Competition (Prize Bond Apps)
| App | Users | Features | Missing |
|-----|-------|----------|---------|
| Pakbond | 1M+ | OCR scan, offline, notifications | No analytics, no web, no digital bonds |
| Pak Bond Checker | ~500K | Save bonds, push alerts | No history, no tools |
| Prize Bond Manager | ~100K | Basic checking | Minimal features |
| **BondCheck (us)** | New | 960K records, multi-source, series/range search, analytics, wallet, PDF, OCR, web-based | Needs market data, more tools |

---

## Current Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1 (App Router) |
| React | 19.2.4 |
| ORM | Drizzle ORM 0.45.2 |
| Database | Neon Serverless PostgreSQL |
| Styling | Tailwind CSS 4 |
| Data Fetching | SWR 2.4.1 |
| Table UI | TanStack React Table 8 |
| PDF Export | jsPDF + jspdf-autotable |
| OCR | Tesseract.js 7 |
| Excel | xlsx 0.18.5 |
| Hosting | Vercel |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

**IMPORTANT:** This is Next.js 16 — it has breaking changes from earlier versions. Always check `node_modules/next/dist/docs/` before writing code. See `AGENTS.md`.

---

## Current Codebase Structure

```
bondcheck-next/
├── app/
│   ├── layout.tsx                    # Root layout (Inter + JetBrains Mono fonts, CookieConsent)
│   ├── page.tsx                      # Home — renders <BondCheckApp />
│   ├── globals.css                   # Tailwind 4 + custom animations
│   ├── admin/page.tsx                # Dev-only scraper admin (404 in production)
│   └── api/
│       ├── health/route.ts           # DB health check
│       ├── search/route.ts           # Single bond search
│       ├── latest/route.ts           # Latest draw dates
│       ├── stats/route.ts            # Aggregate stats (5min cache)
│       ├── draws/route.ts            # Complex filtered/paginated draw results
│       ├── check-multiple/route.ts   # Batch check up to 100 bonds
│       ├── wallet/route.ts           # GET/POST/DELETE/PATCH wallet bonds
│       ├── notifications/route.ts    # GET/PATCH wallet notifications
│       ├── track/route.ts            # Telemetry event ingestion
│       ├── device/register/route.ts  # Device fingerprint upsert
│       ├── gold/route.ts             # [NEW] Gold prices (latest + history)
│       ├── forex/route.ts            # [NEW] Exchange rates (latest + history)
│       ├── crypto/route.ts           # [NEW] Crypto prices (latest + history)
│       ├── savings-rates/route.ts    # [NEW] NS certificate rates
│       ├── draw-schedule/route.ts    # [NEW] Upcoming/recent draws with countdown
│       ├── market-pulse/route.ts     # [NEW] Unified feed (gold+USD+BTC+next draw)
│       ├── tax/route.ts              # [NEW] Tax calculator (5 modes)
│       ├── price-alerts/route.ts     # [NEW] CRUD for price alerts
│       └── cron/
│           ├── scrape/route.ts       # Daily bond results scraper + wallet auto-check
│           ├── prices/route.ts       # [NEW] Gold + forex + crypto every 5min
│           └── daily-data/route.ts   # [NEW] Savings rates + draw schedule daily
├── lib/
│   ├── db.ts                         # Neon HTTP + Drizzle init
│   ├── schema.ts                     # Drizzle schema (13 tables)
│   ├── scraper-logic.ts              # Bond scraper (1228 lines, 2 sources)
│   ├── rate-limit.ts                 # Token-bucket rate limiter
│   ├── fingerprint.ts                # Device fingerprinting (SHA-256 of 13+ signals)
│   ├── history-db.ts                 # IndexedDB client-side history
│   ├── utils.ts                      # formatDate, formatCompact helpers
│   ├── tax.ts                        # [NEW] Tax calculator + expected value + maturity
│   └── scrapers/
│       ├── gold.ts                   # [NEW] goldpricez.com API fetcher
│       ├── forex.ts                  # [NEW] Frankfurter API fetcher
│       ├── crypto.ts                 # [NEW] CoinGecko API fetcher
│       ├── savings-rates.ts          # [NEW] savings.gov.pk scraper + hardcoded fallback
│       └── draw-schedule.ts          # [NEW] 2026 schedule + countdown logic
├── components/
│   ├── BondCheckApp.tsx              # Main app (state, SWR, all handlers)
│   ├── Header.tsx                    # Top bar with refresh + live indicator
│   ├── StatsDashboard.tsx            # 3-col stats cards
│   ├── DrawCountdown.tsx             # [NEW] Upcoming draw cards per denomination
│   ├── WinProbability.tsx            # [NEW] Expected value table per denomination
│   ├── TaxCalculator.tsx             # [NEW] Prize bond tax + savings maturity calc
│   ├── ClaimAssistant.tsx            # [NEW] Claim guide modal (PDF gen, SBP offices)
│   ├── FilterPanel.tsx               # Search modes + filters
│   ├── ResultsTable.tsx              # Results grid (React Table)
│   ├── ScannerModal.tsx              # OCR scanner modal
│   ├── WalletPanel.tsx               # Saved bonds sidebar
│   ├── CookieConsent.tsx             # Privacy consent banner
│   └── ui/
│       ├── AnimatedCounter.tsx       # Count-up animation
│       ├── ColumnHeaderFilter.tsx    # Inline column filter
│       ├── CopyButton.tsx            # Copy with tooltip
│       └── PrizeRankBadge.tsx        # 1st/2nd/3rd badge
├── hooks/
│   ├── useTelemetry.ts              # Device registration + event tracking
│   └── useThrottle.ts               # Throttled callback + disabled state
├── actions/
│   └── scraper.ts                   # Server actions for admin scraping
├── types/
│   └── index.ts                     # All TypeScript interfaces
├── scripts/                          # One-off data scripts
├── drizzle/                          # Migration files
├── vercel.json                       # Cron configuration
├── drizzle.config.ts                 # Drizzle config
├── next.config.ts                    # Next.js config
├── tsconfig.json                     # TypeScript config (strict, ES2018)
└── package.json
```

---

## Database Schema (All Tables)

### 13 tables total (5 original + 8 new)

**Original tables:**

1. **winners** (~960K rows) — Prize bond draw results
   - `id`, `source` (prizeinfo_net/pkprizebond_com), `denomination`, `draw_number`, `draw_date`, `draw_year`, `city`, `bond_number`, `prize_position`, `prize_amount`, `created_at`
   - Unique: (source, denomination, draw_date, bond_number)
   - Indexes: bond_number, denomination, draw_date, draw_number

2. **devices** — Anonymous device fingerprints
   - `id`, `fingerprint` (SHA-256, unique), `first_seen`, `last_seen`, `total_sessions`, `os`, `browser`, `device_type`, `screen_res`, `language`, `timezone`, `country`, `city`, `raw_meta` (JSONB)

3. **wallet_bonds** — Saved bonds per device
   - `id`, `device_fingerprint`, `bond_number`, `label`, `denomination`, `added_at`
   - Unique: (device_fingerprint, bond_number)

4. **wallet_notifications** — Auto-check win alerts
   - `id`, `device_fingerprint`, `bond_number`, `winner_id`, `denomination`, `prize_position`, `prize_amount`, `draw_date`, `seen` (0/1), `created_at`

5. **events** — Telemetry/analytics
   - `id`, `device_fingerprint`, `session_id`, `event_type`, `event_data` (JSONB), `page`, `referrer`, `ip`, `user_agent`, `screen_width`, `screen_height`, `language`, `timezone`, `connection_type`, `battery_level`, `lat`, `lng`, `created_at`

**New tables (Phase 1-2 backend):**

6. **gold_prices** — Gold price time-series
   - `id`, `source`, `karat` (24k/22k/21k), `unit` (tola/gram), `price_pkr`, `price_usd`, `recorded_at`
   - Unique: (source, karat, unit, recorded_at)

7. **exchange_rates** — Forex time-series
   - `id`, `base_currency`, `quote_currency`, `rate_type` (interbank/open_market), `rate`, `source`, `recorded_at`
   - Index: (base_currency, quote_currency, recorded_at)

8. **crypto_prices** — Crypto snapshots
   - `id`, `symbol` (BTC/ETH/USDT/BNB/SOL), `price_usd`, `price_pkr`, `change_24h_percent`, `volume_24h`, `source`, `recorded_at`

9. **savings_rates** — NS certificate rates (historical)
   - `id`, `certificate_type`, `display_name`, `rate_percent`, `effective_date`, `maturity_period`, `min_investment`, `eligibility`, `profit_payment`, `source`, `scraped_at`

10. **draw_schedule** — Prize bond draw schedule
    - `id`, `denomination`, `draw_number`, `draw_date`, `city`, `status` (scheduled/completed/results_available), `source`, `created_at`

11. **crypto_prices** — Already listed above

12. **price_alerts** — User-configured price alerts
    - `id`, `device_fingerprint`, `alert_type` (gold_above/gold_below/usd_above/usd_below/btc_above/btc_below/draw_reminder), `target_value`, `params` (JSONB), `triggered`, `triggered_at`, `created_at`
    - Max 20 active alerts per device

13. **analytics_daily** — Aggregated daily stats
    - `id`, `date` (unique), `total_sessions`, `unique_devices`, `total_searches`, `total_wallet_checks`, `total_bond_scans`, `top_denominations` (JSONB), `device_breakdown` (JSONB), `browser_breakdown` (JSONB)

14. **market_indices** — KSE-100 etc. daily values
    - `id`, `index_name`, `open_value`, `high_value`, `low_value`, `close_value`, `volume`, `change_percent`, `trade_date`, `source`, `recorded_at`

**Migration file:** `drizzle/0002_far_morgan_stark.sql`

---

## All API Endpoints

### Original (bond checking)
| Method | Route | Rate Limit | Purpose |
|--------|-------|------------|---------|
| GET | `/api/health` | 15/10 | DB health + record count |
| GET | `/api/search?number=XXXXXX` | 5/3 | Single bond lookup |
| GET | `/api/latest?denomination=X` | 15/10 | Latest draw dates |
| GET | `/api/stats` | 15/10 | Aggregate stats (5min cache) |
| GET | `/api/draws?[filters]` | 5/3 | Complex filtering + pagination |
| POST | `/api/check-multiple` | 5/3 | Batch check 1-100 bonds |
| GET/POST/DELETE/PATCH | `/api/wallet` | - | Wallet CRUD + batch check |
| GET/PATCH | `/api/notifications` | 10/5 | Wallet win notifications |
| POST | `/api/track` | - | Telemetry event ingestion |
| POST | `/api/device/register` | - | Device fingerprint upsert |

### New (Phase 1-2 backend)
| Method | Route | Rate Limit | Purpose |
|--------|-------|------------|---------|
| GET | `/api/gold?mode=latest\|history` | 15/10 | Gold prices (karat, unit, days params) |
| GET | `/api/forex?mode=latest\|history` | 15/10 | Exchange rates (base, days params) |
| GET | `/api/crypto?mode=latest\|history` | 15/10 | Crypto prices (symbol, days params) |
| GET | `/api/savings-rates` | 15/10 | NS certificate rates |
| GET | `/api/draw-schedule?mode=all\|next` | 15/10 | Draw schedule + countdown |
| GET | `/api/market-pulse` | 15/10 | Unified feed (60s cache) |
| GET | `/api/tax?mode=prize\|savings\|maturity\|expected_value\|compare` | 15/10 | Tax calculators |
| GET/POST/DELETE | `/api/price-alerts?fp=X` | 10/5 | Price alert CRUD |

### Cron endpoints
| Route | Schedule | Auth | Purpose |
|-------|----------|------|---------|
| `/api/cron/scrape` | `0 1 * * *` (1 AM UTC) | CRON_SECRET | Bond results + wallet auto-check |
| `/api/cron/prices` | `*/5 * * * *` (every 5 min) | CRON_SECRET | Gold + forex + crypto |
| `/api/cron/daily-data` | `0 12 * * *` (noon UTC) | CRON_SECRET | Savings rates + draw schedule |

---

## Cron Jobs

Configured in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/scrape", "schedule": "0 1 * * *" },
    { "path": "/api/cron/prices", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/daily-data", "schedule": "0 12 * * *" }
  ]
}
```

**Note:** Vercel Free tier = 1 cron job. Need Pro ($20/mo) for multiple crons.

---

## Free Data Sources

| Data | Source | Cost | Rate Limit |
|------|--------|------|------------|
| Gold PKR/tola | goldpricez.com/api | Free | 30-60 req/hr |
| Forex (USD/EUR/GBP/SAR/AED to PKR) | api.frankfurter.dev | Free, no key | ~unlimited |
| SBP official rates | sbp.org.pk scrape | Free | Be respectful |
| NS certificate rates | savings.gov.pk scrape | Free | Be respectful |
| KSE-100 index | dps.psx.com.pk scrape | Free | Be respectful |
| Crypto (BTC/ETH/USDT/BNB/SOL) | api.coingecko.com | Free, no key | 10-30 req/min |
| Draw schedule | savings.gov.pk | Free | Hardcoded + scrape |
| Bond results | prizeinfo.net + pkprizebond.com | Free | Scrape |
| CPI/Inflation | SBP EasyData | Free | Scrape |
| Utility bills | ebillpakistan.com (future) | Free | Scrape |

---

## Phase 1: Prize Bond Dominance — DONE

### What was built:

**Backend:**
- Draw schedule API with 2026 dates for ALL denominations including digital bonds
- Tax calculator: prize bond tax, savings WHT, compound maturity, expected value per denomination, denomination comparison
- Price alerts CRUD (max 20 per device)
- All new DB tables + migration
- Gold/Forex/Crypto/Savings scrapers (backend only — feeds built for Phase 2)
- 3 cron jobs configured

**Frontend components (integrated into BondCheckApp.tsx):**
- `DrawCountdown` — Cards per denomination showing days until next draw, pulsing indicator for urgent (<7 days)
- `WinProbability` — Table with expected value, win probability, effective return per denomination. Filer/non-filer toggle.
- `TaxCalculator` — Two modes: prize bond tax (with quick presets for common amounts) and savings maturity calculator (with quick presets for NS certificate rates). Filer/non-filer toggle.
- `ClaimAssistant` — Modal with: win summary, tax breakdown, step-by-step claim process (different for 1st/2nd vs 3rd), SBP office locator with geolocation distance sorting, PDF claim guide generator

**Digital bond support:**
- Rs 500, 1000, 5000, 10000 added to prize structures in `lib/tax.ts`
- Added to draw schedule in `lib/scrapers/draw-schedule.ts`
- Labels added to `DrawCountdown` component

**ClaimAssistant is triggered when a user finds a winning bond** — it needs to be wired up from the ResultsTable or WalletPanel (connection point exists but needs a trigger button on winning results).

---

## Phase 2: Daily Market Pulse — TODO

**Goal:** Give users a reason to open the app EVERY DAY, not just on draw days. Gold + USD + crypto prices change daily.

### 2a. KSE-100 Scraper
- **Backend exists:** `market_indices` table in schema
- **Need:** `lib/scrapers/market-indices.ts` — scrape `dps.psx.com.pk/indices` for daily KSE-100/KSE-30/KMI-30
- **Need:** `/api/market-indices` route (latest + history)
- **Need:** Add to `/api/cron/daily-data` cron
- **Note:** PSX data redistribution is gray area. Attribute clearly.

### 2b. Market Pulse Frontend Widget
- **Backend exists:** `/api/market-pulse` returns unified feed
- **Need:** `components/MarketPulse.tsx` — single scrollable card showing:
  - Gold 24K/tola price with change indicator
  - USD/PKR rate
  - BTC price in USD
  - KSE-100 value + daily change %
  - Next draw countdown (nearest)
- **Design:** Match existing style — white card, gray-200 border, monospace numbers, compact layout
- **Position:** Place between `StatsDashboard` and `DrawCountdown` in BondCheckApp
- **SWR config:** revalidate every 60 seconds for prices

### 2c. Individual Market Pages (optional but high value)
- Gold detail page: all karats, tola + gram, 1D/1W/1M/3M charts, price alerts UI
- Forex detail: all 7 currencies vs PKR, interbank vs open market
- Crypto detail: all 5 coins, PKR conversion, 24h change
- These could be separate routes (`/gold`, `/forex`, `/crypto`) or collapsible sections

### 2d. Price Alerts UI
- **Backend exists:** `/api/price-alerts` CRUD
- **Need:** Alert creation UI — dropdown for type, input for threshold value
- **Need:** Alert list showing active alerts with delete button
- **Could be:** Part of each market detail section or a unified alerts panel

### 2e. Wire ClaimAssistant to Results
- Add a "Claim Guide" button on winning bond results in `ResultsTable` or `WalletPanel`
- When clicked, opens `ClaimAssistant` modal with the bond details pre-filled

---

## Phase 3: National Savings Hub — TODO

**Goal:** Become THE app for all National Savings products. Same user base (NS investors = prize bond holders).

### 3a. NS Product Explorer
- **Backend exists:** `/api/savings-rates` returns all 11 certificate types
- **Need:** `components/SavingsExplorer.tsx` — interactive catalog:
  - Cards for each certificate type with current rate, maturity, min investment
  - Eligibility filter (BSC = widows/elderly only, PBA = pensioners only)
  - Click to expand with full details + "Calculate Returns" button linking to TaxCalculator
- **Data:** Already in `lib/scrapers/savings-rates.ts` (CURRENT_RATES array)

### 3b. Investment Comparison Calculator
- **Need:** `components/InvestmentComparison.tsx`
- Side-by-side comparison: NS certificates vs bank FD vs prize bonds
- Inputs: investment amount, time horizon, filer status
- Show: after-tax returns, inflation-adjusted real returns, risk comparison
- Use CPI data from SBP for inflation adjustment
- **New data needed:** Bank FD rates (hardcode top 5 banks initially, scrape later)

### 3c. Profit Rate Alert System
- When savings rates change (detected by daily scrape), notify users
- **Needs web push (Phase 7)** to actually deliver alerts
- For now: store rate change events, show "rates changed" banner in app

### 3d. Savings Goal Tracker
- **Need new table:** `savings_goals` (device_fingerprint, name, target_amount, current_amount, target_date, suggested_product)
- **Need:** `components/SavingsGoal.tsx` — set target, track progress, suggest optimal NS product mix
- **Need:** `/api/savings-goals` CRUD route

---

## Phase 4: Islamic Finance Tools — TODO

**Goal:** Build tools uniquely Pakistani/Muslim. Launch before Ramadan for 5-10x traffic spike.

### 4a. Zakat Calculator
- **THE most data-rich feature** — a complete Zakat calc gives us the user's entire financial picture
- **Need:** `components/ZakatCalculator.tsx`
- Categories: cash on hand, bank balances, gold/silver (with live price integration from our gold API), stocks, business inventory, rental income, crypto holdings, prize bonds, NS certificates
- Auto Nisab calculation: gold Nisab (~87.48g) and silver Nisab (~612.36g) using live gold/silver prices
- Lunar year tracking (Zakat due on Islamic calendar anniversary)
- Save annually for year-over-year comparison
- **Need new table:** `zakat_records` (device_fingerprint, year_hijri, year_gregorian, assets JSONB, nisab_value, zakat_due, calculated_at)
- Show both scholar positions on whether prize bonds are Zakat-able

### 4b. Islamic Investment Comparator
- Compare SISA/SITA (Shariah-compliant NS products) vs conventional NS products
- Show PSX Shariah-compliant stock filter (KMI-30 index)
- Flag which features involve riba concerns
- Lighter feature — can be a section within SavingsExplorer

---

## Phase 5: Tax & Government — TODO

**Goal:** Handle bureaucratic complexity that Pakistanis dread. Tax season (July-Sept) = massive traffic.

### 5a. Income Tax Calculator
- **Need:** `lib/income-tax.ts` with 2025-26 slab data
- Salaried vs non-salaried slabs
- Include common deductions and exemptions
- Show effective tax rate
- "How much tax will I save by investing in X?" scenarios
- **Need:** `components/IncomeTaxCalculator.tsx`

### 5b. Government Scheme Tracker
- Consolidated dashboard: BISP/Ehsaas eligibility, Kamyab Jawan Program, PM Laptop Scheme, Naya Pakistan Housing
- **Need:** Scrape or hardcode eligibility criteria
- **Need:** `components/GovtSchemes.tsx`
- "What government benefits am I eligible for?" questionnaire

### 5c. FBR Active Taxpayer Checker
- Quick CNIC check against FBR Active Taxpayer List
- Show implications of non-filer status (double tax on everything)
- Step-by-step guide to becoming a filer
- **Note:** FBR has an online check — may need to proxy or scrape

---

## Phase 6: Personal Finance Layer — TODO

**Goal:** Own the user's daily financial life. This is where retention becomes unbreakable.

### 6a. Bill Payment Tracker
- NOT actual bill payment (that's JazzCash territory) — track and analyze bills
- Input consumer numbers for LESCO, MEPCO, GEPCO, PESCO, SNGPL, SSGC, WASA, PTCL
- Auto-fetch amounts from public APIs (ebillpakistan.com model)
- Monthly trends, due date reminders, annual summary
- **Need new tables:** `bill_accounts` (device_fingerprint, provider, consumer_number, label), `bill_records` (bill_account_id, amount, due_date, billing_month)
- **Data collected:** Household size, location, consumption = income proxy

### 6b. Expense Tracker
- Quick PKR-native logger with Pakistani categories: Grocery (kiryana), Transport (petrol/CNG/Careem), Utilities, School fees, Medical, Eid expenses, Ramadan expenses
- SMS parser: detect JazzCash/EasyPaisa/bank transaction SMS and auto-categorize
- Weekly/monthly reports
- **Need new tables:** `expenses` (device_fingerprint, amount, category, note, date)
- **Need:** `components/ExpenseTracker.tsx`

### 6c. Net Worth Dashboard
- Aggregate view from all BondCheck data:
  - Prize bonds in wallet (denomination values)
  - Gold holdings (from Zakat calc, valued at live rates)
  - Crypto holdings (from crypto tracker)
  - NS certificates (manual entry)
  - Bank savings (from Zakat calc)
  - Property (manual entry)
  - Minus: loans
- "Your net worth over time" chart
- **This is the crown jewel.** No Pakistani app provides this.

---

## Phase 7: Infra & Monetization — TODO

### 7a. PWA (Progressive Web App)
- `public/manifest.json` with app icons (192x192, 512x512)
- `public/sw.js` — custom service worker:
  - Cache-first for static assets (HTML, CSS, JS, fonts)
  - Network-first with stale fallback for API data
  - Offline fallback page (`public/offline.html`)
- Register SW in `app/layout.tsx`
- "Install App" prompt component
- **Critical for Pakistani market** — many users on slow mobile data

### 7b. Web Push Notifications
- Self-hosted via [web-push](https://www.npmjs.com/package/web-push) npm library with VAPID keys
- Zero cost, no Firebase dependency
- **Need new table:** `push_subscriptions` (device_fingerprint, endpoint, p256dh, auth, active)
- **Triggers:**
  - Draw results available (after scrape cron)
  - Wallet bond won (critical priority)
  - Draw reminder (1 day before)
  - Price alert threshold crossed
  - Savings rate change detected

### 7c. Vercel KV (Redis)
- Replace in-memory caches (rate limiter buckets, stats cache, total count cache)
- Persistent across cold starts
- Cost: Free = 30K req/day, Pro = $3-25/mo for 100K-1M req/day
- Use for: rate limiting, cached stats, cached prices, session data

### 7d. CDN Cache Headers
- Add `Cache-Control: public, s-maxage=X, stale-while-revalidate=Y` to API responses
- /api/stats: s-maxage=300 (5 min)
- /api/gold, /api/forex: s-maxage=60 (1 min)
- /api/market-pulse: s-maxage=60
- /api/draw-schedule: s-maxage=3600 (1 hour)
- /api/savings-rates: s-maxage=86400 (1 day)
- Could reduce function invocations by 80-90%

### 7e. Public API v1
- Versioned endpoints: `/api/v1/gold`, `/api/v1/forex`, `/api/v1/bonds/search`, etc.
- **Need new table:** `api_keys` (key_hash, owner, email, tier, rate_limit_per_day, requests_today, active)
- Tiers: Free (100/day), Basic $9/mo (5K/day), Pro $29/mo (50K/day), Enterprise (custom)
- Middleware for API key validation

### 7f. Events Aggregation Pipeline
- Daily cron at 3 AM: roll up raw events into `analytics_daily`
- SQL: COUNT DISTINCT sessions, devices, searches by date
- Delete raw events > 90 days old
- This prevents the events table from growing infinitely

### 7g. BondCheck PRO (Premium Tier)
- Price: Rs. 500/month (~$2)
- Features: unlimited wallet bonds (free = 50), advanced analytics, priority results, Excel export, SMS notifications, ad-free
- **Need:** Payment integration (JazzCash/EasyPaisa API or Stripe Pakistan)
- **Need:** Feature gating logic per device fingerprint

---

## Phase 8: Community & Growth — TODO

### 8a. Draw Day Live Feed
- Real-time community experience on draw days
- "X people checking bonds right now" counter
- Anonymous winner celebration wall: "Someone in Lahore won Rs. 75 lakh!"
- Stats: bonds checked in last hour
- Creates FOMO, drives invites

### 8b. Financial News Feed
- Curated RSS from Dawn Business, Business Recorder, The News International
- AI-filtered for relevance: SBP decisions, NS rate changes, gold moves, tax policy
- Push notification for breaking financial news

### 8c. Financial Literacy Mini-Courses
- Bite-sized content: "Understanding Prize Bonds", "Filer vs Non-Filer", "NS Certificates Explained", "Islamic Finance Basics"
- Quiz format with progress tracking
- Shareable completion certificates (WhatsApp viral loop)
- Aligned with SBP's National Financial Education Roadmap (2025-2029) — potential government partnership

---

## Data Collection Strategy

Every feature collects a specific data dimension. The composite user profile WITHOUT requiring signup:

| Data Dimension | Source Feature | Business Value |
|----------------|---------------|----------------|
| Device, OS, location | Fingerprinting (existing) | Segmentation |
| Bond denominations held | Wallet (existing) | Investment level |
| Search frequency/timing | Analytics (existing) | Engagement |
| Investment risk appetite | Win probability / comparison tools | Sophistication |
| Income range | Tax calculator, expense tracker | Monetization targeting |
| Filer/non-filer status | Tax calculator | Regulatory signal |
| Complete net worth | Zakat calculator, net worth dashboard | Full financial profile |
| Religious finance preference | Islamic tools usage | Product recommendations |
| Gold/crypto/equity interest | Market dashboard | Cross-sell |
| Geographic location | Claim assistant, bill tracker | Hyperlocal targeting |
| Financial literacy level | Mini-courses, quiz scores | Content personalization |
| Spending patterns | Expense tracker | Behavioral finance |
| Household size/utility usage | Bill tracker | Demographic profiling |

**By Phase 6, BondCheck will have the most detailed anonymous financial profile database in Pakistan.**

---

## Monetization Plan

| Channel | Expected Revenue | When |
|---------|-----------------|------|
| BondCheck PRO subscription (Rs 500/mo) | High | Phase 7 |
| API licensing (developer access to bond + market data) | Medium | Phase 7 |
| Bank/investment affiliate leads ($1-5/lead) | Medium-High | Phase 8 |
| Targeted ads (gold dealers, banks, JazzCash — denomination = wealth signal) | Low-Medium | Phase 8 |
| Sponsored financial content from banks | Medium | Phase 8 |

**Do NOT rely on AdSense** — Pakistan CPM is $0.11. Lead gen and premium features are the play.

---

## Design System & Conventions

### Colors
- Primary: `#0f172a` (slate-950, dark blue-black)
- Background: `#f8fafc` (slate-50)
- Success/positive: emerald-500/600
- Error/negative: red-500
- Muted text: gray-400, gray-500
- Borders: gray-100, gray-200

### Typography
- Sans: Inter (400, 500, 600, 700)
- Mono: JetBrains Mono (400, 700) — used for numbers, prices, bond numbers
- Labels: 10px uppercase tracking-wider font-semibold text-gray-500
- Section headers: `text-xs font-semibold text-gray-500 uppercase tracking-wider`

### Component Patterns
- Cards: `bg-white border border-gray-200 rounded-sm`
- Buttons: `bg-[#0f172a] text-white text-xs font-medium py-2.5 px-4 rounded-sm`
- Toggle groups: `bg-gray-100 rounded-sm overflow-hidden` with active state `bg-[#0f172a] text-white`
- Stats numbers: `font-mono font-semibold`
- Subtle dividers: `divide-y divide-gray-100` or `border-b border-gray-100`

### Code Conventions
- Files: PascalCase components, camelCase utilities/hooks
- DB columns: snake_case (Drizzle schema uses camelCase JS → snake_case SQL)
- API responses: snake_case JSON keys
- Types: PascalCase interfaces in `types/index.ts`
- Rate limiting: always use `rateLimit(request, maxTokens, refillRate, prefix)` pattern
- Error responses: `{ error: String(error) }` with status 500
- SWR: `revalidateOnFocus: false, revalidateIfStale: false` with manual refresh
- New API routes: always include rate limiting as first line

---

## Important Notes for Development

1. **This is Next.js 16** — check `node_modules/next/dist/docs/` before writing code. Breaking changes from older versions. See `AGENTS.md`.

2. **Run migration before deploying:** `npx drizzle-kit push` or `npx drizzle-kit migrate` to apply `drizzle/0002_far_morgan_stark.sql`.

3. **Vercel Pro required** for multiple cron jobs. Free tier only allows 1 cron.

4. **CRON_SECRET env var** must be set in Vercel for cron endpoint auth.

5. **ClaimAssistant needs wiring** — the component exists but needs a trigger button added to ResultsTable/WalletPanel when a winning bond is found.

6. **Digital bond prize structures are estimated** — the Rs 500/1000/5000/10000 prize amounts in `lib/tax.ts` are based on available information but may need updating when official CDNS data is confirmed.

7. **Savings rates are hardcoded with scraper fallback** — `lib/scrapers/savings-rates.ts` has hardcoded Jan 2026 rates. The scraper attempts to fetch live data from savings.gov.pk but falls back to hardcoded. Update hardcoded values when rates change.

8. **Draw schedule is hardcoded for 2026** — `lib/scrapers/draw-schedule.ts` has the full 2026 schedule. Needs manual update for 2027 or a more robust scraper.

9. **Rate limiter is in-memory** — resets on cold starts. Phase 7 (Vercel KV) fixes this.

10. **No user accounts** — everything is tied to device fingerprints (localStorage `bcp_device_fp`). This is intentional for frictionless UX but fragile across browser resets. Phase 7+ should add optional accounts.

11. **Consent check is missing** — telemetry fires before checking cookie consent. Fix before scaling or there will be compliance issues.

12. **goldpricez.com API** — free tier is 30-60 req/hour. Our 5-minute cron uses ~12 req/hour. Within limits.

13. **Frankfurter API** — ECB-sourced, updates on business days only. Weekend rates are last Friday's rates.

14. **CoinGecko free tier** — 10-30 req/min. Our cron fetches 1 endpoint every 5 min. Safe.
