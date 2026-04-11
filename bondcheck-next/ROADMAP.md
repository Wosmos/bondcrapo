# BondCheck — Halal Financial Literacy Platform for Pakistan

> Helping ordinary Pakistanis understand their finances through a halal-only lens.

---

## CORE PRINCIPLE: HALAL ONLY

This app will NEVER include:
- Cryptocurrency (speculative, majority scholars say haram)
- Forex trading features (speculative trading is haram)
- Conventional interest/riba calculators or promotion
- Conventional bank FD comparisons
- Compound interest maturity calculators for conventional products
- Stock market speculation features
- Any content where scholars significantly disagree on permissibility

This app WILL include:
- Prize bonds (government savings program)
- Gold & silver prices (halal real assets)
- Currency exchange rates (informational — people need to know rates)
- Government commodity prices (petrol, diesel, flour, sugar, ghee, cooking oil, essentials)
- Islamic banking products ONLY (Meezan Bank, Al-Baraka, SISA, SITA, etc.)
- Zakat calculator (obligatory Islamic duty)
- Tax calculators (government compliance)
- Government welfare schemes (BISP, Ehsaas, Kamyab Jawan)
- Pakistani financial/economic news
- Bill tracking, expense tracking
- Islamic financial literacy education

When promoting banking: Islamic banking ONLY. Sunni-agreed rulings. Include Shia-agreed where possible. No controversial fiqh.

---

## Table of Contents

1. [Vision](#vision)
2. [Market Research](#market-research)
3. [Tech Stack](#tech-stack)
4. [Codebase Structure](#codebase-structure)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Cron Jobs](#cron-jobs)
8. [Free Data Sources](#free-data-sources)
9. [Phase 1: Prize Bond Dominance — ~90% DONE](#phase-1-prize-bond-dominance--90-done)
10. [Phase 2: Daily Price Dashboard — TODO](#phase-2-daily-price-dashboard--todo)
11. [Phase 3: Islamic Finance Hub — TODO](#phase-3-islamic-finance-hub--todo)
12. [Phase 4: Tax & Government — TODO](#phase-4-tax--government--todo)
13. [Phase 5: Personal Finance — TODO](#phase-5-personal-finance--todo)
14. [Phase 6: Infra & Scale — TODO](#phase-6-infra--scale--todo)
15. [Phase 7: Community & Education — TODO](#phase-7-community--education--todo)
16. [Design System](#design-system)
17. [Dev Notes](#dev-notes)

---

## Vision

BondCheck helps Pakistan's 7M+ National Savings investors and 117M internet users understand:
- Did their prize bonds win? (we already do this better than anyone)
- What's gold/silver worth today? (daily price tracking)
- What's petrol/diesel/flour/sugar costing? (government commodity prices)
- How to calculate and pay Zakat properly?
- Which Islamic banking products offer the best halal returns?
- What government welfare schemes are they eligible for?
- How to file taxes correctly?

No competitor does this. Pakbond (1M+ users) is just a bond checker. JazzCash/EasyPaisa are payment apps. Nobody is the "halal financial knowledge" app.

---

## Market Research

### Pakistani Market (Real Numbers, April 2026)
- CDNS total portfolio: Rs. 3.4 trillion (~$12.1B) across 7M+ investors
- Internet users: 117M (45.6% penetration)
- Mobile connections: 194M
- Raast users: 47M
- Digital wallet penetration: 50.2%
- 81% of digital transactions via mobile apps
- Only 23-26% of Pakistanis are financially literate (vs 33% global average)

### Prize Bond Market
- Active denominations: Rs. 100, 200, 750, 1500 (physical) + Rs. 25000, 40000 (premium registered)
- Digital bonds launched 2025: Rs. 500, 1000, 5000, 10000 (registered to CNIC)
- Bearer bonds (7500/15000/25000/40000) discontinued, encashment ended Dec 31 2024
- Tax: 15% filer / 30% non-filer
- ~70,600 winners per year, Rs. 1.6B total prize money

### Gold Market
- Pakistanis hold estimated 3,000-5,000 tonnes of gold ($40-70B)
- Gold is deeply culturally embedded (weddings, savings, Zakat asset)
- People check gold rates DAILY — this is the daily retention hook

### Islamic Banking in Pakistan
- Meezan Bank: largest Islamic bank
- Islamic banking market share: ~20% and growing
- SISA (Sarwa Islamic Savings Account): 8.40%
- SITA (Sarwa Islamic Term Account): 10.80%
- Demand for Islamic financial products is massive and underserved digitally

---

## Tech Stack

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
| Hosting | Vercel |

**IMPORTANT:** Next.js 16 has breaking changes. Check `node_modules/next/dist/docs/` before writing code.

---

## Codebase Structure

```
bondcheck-next/
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Home — <BondCheckApp />
│   ├── globals.css                   # Tailwind 4 + custom styles
│   ├── admin/page.tsx                # Dev-only scraper admin
│   └── api/
│       ├── health/route.ts           # DB health
│       ├── search/route.ts           # Single bond search
│       ├── latest/route.ts           # Latest draw dates
│       ├── stats/route.ts            # Aggregate stats (5min cache)
│       ├── draws/route.ts            # Filtered/paginated results
│       ├── check-multiple/route.ts   # Batch check bonds
│       ├── wallet/route.ts           # Wallet CRUD
│       ├── notifications/route.ts    # Win notifications
│       ├── track/route.ts            # Telemetry ingestion
│       ├── device/register/route.ts  # Device fingerprint
│       ├── gold/route.ts             # Gold prices
│       ├── forex/route.ts            # Currency rates (informational)
│       ├── crypto/route.ts           # [TO REMOVE — haram]
│       ├── savings-rates/route.ts    # NS certificate rates
│       ├── draw-schedule/route.ts    # Draw schedule + countdown
│       ├── market-pulse/route.ts     # Unified feed
│       ├── tax/route.ts              # Tax calculator
│       ├── price-alerts/route.ts     # Price alerts CRUD
│       └── cron/
│           ├── scrape/route.ts       # Daily bond scraper
│           ├── prices/route.ts       # Gold + currency prices
│           └── daily-data/route.ts   # Savings rates + schedule
├── lib/
│   ├── db.ts                         # Neon + Drizzle init
│   ├── schema.ts                     # 13 DB tables (remove crypto_prices)
│   ├── scraper-logic.ts              # Bond scraper (1228 lines)
│   ├── rate-limit.ts                 # Token-bucket rate limiter
│   ├── fingerprint.ts                # Device fingerprinting
│   ├── history-db.ts                 # IndexedDB history
│   ├── utils.ts                      # Helpers
│   ├── tax.ts                        # Tax + expected value (remove crypto refs)
│   └── scrapers/
│       ├── gold.ts                   # goldpricez.com API
│       ├── forex.ts                  # Frankfurter API (informational)
│       ├── crypto.ts                 # [TO REMOVE — haram]
│       ├── savings-rates.ts          # savings.gov.pk
│       └── draw-schedule.ts          # 2026 schedule
├── components/
│   ├── BondCheckApp.tsx              # Main app
│   ├── Header.tsx
│   ├── StatsDashboard.tsx
│   ├── DrawCountdown.tsx             # Upcoming draws
│   ├── WinProbability.tsx            # Expected value table
│   ├── TaxCalculator.tsx             # Tax calc (needs cleanup — remove savings interest mode)
│   ├── ClaimAssistant.tsx            # Claim guide modal
│   ├── FilterPanel.tsx
│   ├── ResultsTable.tsx
│   ├── ScannerModal.tsx
│   ├── WalletPanel.tsx
│   ├── CookieConsent.tsx
│   └── ui/ (AnimatedCounter, CopyButton, PrizeRankBadge, etc.)
├── hooks/ (useTelemetry, useThrottle)
├── types/index.ts
├── vercel.json                       # Cron config
└── drizzle/                          # Migrations
```

### Files to REMOVE or MODIFY:
- **REMOVE:** `lib/scrapers/crypto.ts` — haram
- **REMOVE:** `app/api/crypto/route.ts` — haram
- **MODIFY:** `lib/schema.ts` — remove `crypto_prices` table
- **MODIFY:** `app/api/market-pulse/route.ts` — remove crypto from unified feed
- **MODIFY:** `app/api/cron/prices/route.ts` — remove crypto fetch from cron
- **MODIFY:** `lib/tax.ts` — remove crypto references if any
- **MODIFY:** `types/index.ts` — remove CryptoPrice, CryptoResponse types
- **MODIFY:** `components/TaxCalculator.tsx` — the "Savings Maturity" mode calculates compound interest for conventional NS certificates. Keep for Islamic products only (SISA/SITA) or remove the compound interest framing and show "expected profit" instead

---

## Database Schema

### Existing tables (keep):
1. **winners** (~960K rows) — prize bond results
2. **devices** — anonymous fingerprints
3. **wallet_bonds** — saved bonds per device
4. **wallet_notifications** — win alerts
5. **events** — telemetry
6. **gold_prices** — gold time-series
7. **exchange_rates** — currency rates (informational)
8. **savings_rates** — NS certificate rates (Islamic products only going forward)
9. **draw_schedule** — draw calendar
10. **price_alerts** — user alerts (gold, currency, draw reminders)
11. **analytics_daily** — aggregated stats
12. **market_indices** — [REPURPOSE: use for govt commodity prices instead of KSE-100]

### Table to REMOVE:
- **crypto_prices** — haram, delete from schema and migration

### New tables needed (future phases):
- **commodity_prices** — petrol, diesel, flour, sugar, ghee, cooking oil, pulses (OGRA + PBS data)
- **silver_prices** — silver PKR per tola (same structure as gold_prices)
- **islamic_bank_rates** — profit rates from Meezan, Al-Baraka, BankIslami, etc.
- **zakat_records** — user Zakat calculations (device_fp, year_hijri, assets JSONB, zakat_due)
- **news_articles** — cached news from free API
- **bill_accounts** / **bill_records** — utility bill tracking
- **expenses** — expense tracking

---

## API Endpoints

### Keep (bond checking — original):
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | DB health |
| GET | `/api/search` | Single bond lookup |
| GET | `/api/latest` | Latest draw dates |
| GET | `/api/stats` | Aggregate stats |
| GET | `/api/draws` | Filtered/paginated results |
| POST | `/api/check-multiple` | Batch check bonds |
| CRUD | `/api/wallet` | Wallet bonds |
| GET/PATCH | `/api/notifications` | Win notifications |
| POST | `/api/track` | Telemetry |
| POST | `/api/device/register` | Device fingerprint |

### Keep (Phase 1-2 — halal):
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/gold` | Gold prices (latest + history) |
| GET | `/api/forex` | Currency rates — informational (latest + history) |
| GET | `/api/savings-rates` | Islamic savings product rates |
| GET | `/api/draw-schedule` | Draw schedule + countdown |
| GET | `/api/market-pulse` | Unified feed (remove crypto) |
| GET | `/api/tax` | Tax calculators |
| CRUD | `/api/price-alerts` | Price alerts |

### REMOVE:
| Route | Reason |
|-------|--------|
| `/api/crypto` | Haram — cryptocurrency |

### New routes needed (future):
| Route | Phase | Purpose |
|-------|-------|---------|
| `/api/silver` | 2 | Silver prices |
| `/api/commodities` | 2 | Petrol, diesel, flour, sugar, ghee, cooking oil |
| `/api/news` | 2 | Pakistani financial news feed |
| `/api/islamic-banking` | 3 | Islamic bank profit rates |
| `/api/zakat` | 3 | Zakat calculator CRUD |
| `/api/income-tax` | 4 | Income tax slab calculator |
| `/api/govt-schemes` | 4 | BISP, Kamyab Jawan eligibility |

---

## Cron Jobs

```json
{
  "crons": [
    { "path": "/api/cron/scrape", "schedule": "0 1 * * *" },
    { "path": "/api/cron/prices", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/daily-data", "schedule": "0 12 * * *" }
  ]
}
```

- `/api/cron/prices` — currently fetches gold + forex + ~~crypto~~. Remove crypto.
- `/api/cron/daily-data` — savings rates + draw schedule. Add commodity prices later.

---

## Free Data Sources

| Data | Source | Cost |
|------|--------|------|
| Gold PKR/tola (24K/22K/21K) | goldpricez.com/api | Free, 30-60 req/hr |
| Silver PKR/tola | goldpricez.com/api (supports silver) | Free |
| Currency rates (USD/EUR/GBP/SAR/AED/CAD/AUD to PKR) | api.frankfurter.dev | Free, no key |
| SBP official rates | sbp.org.pk scrape | Free |
| Petrol/diesel prices | OGRA (ogra.org.pk) scrape | Free |
| Grocery commodity prices | PBS (pbs.gov.pk) or Utility Stores data | Free |
| Islamic banking rates | Meezan Bank website scrape | Free |
| NS Islamic products (SISA/SITA) | savings.gov.pk scrape | Free |
| Prize bond results | prizeinfo.net + pkprizebond.com | Free |
| Draw schedule | savings.gov.pk | Free |
| News | GNews API (free tier: 100 req/day) or NewsData.io (free: 200 req/day) | Free |

---

## Phase 1: Prize Bond Dominance — ~90% DONE

### Done:
- Draw schedule backend + frontend countdown per denomination
- Digital bond support (Rs 500/1000/5000/10000) in prize structures + schedule
- Win probability analytics backend + frontend table
- Tax calculator backend (prize bond WHT, filer/non-filer) + frontend
- Claim assistant (SBP office locator, geolocation, PDF claim guide generator)
- All components integrated in BondCheckApp.tsx

### Still TODO:
- **Wire ClaimAssistant trigger** — add a "Claim Guide" button on winning bonds in ResultsTable and/or WalletPanel. The ClaimAssistant component exists but has no trigger button yet.

---

## Phase 2: Daily Price Dashboard — TODO

**Goal:** People open the app DAILY to check gold prices, petrol prices, and news. Not just on draw days.

### 2.1 Remove Crypto (cleanup)
- Delete `lib/scrapers/crypto.ts`
- Delete `app/api/crypto/route.ts`
- Remove `crypto_prices` from `lib/schema.ts`
- Remove crypto from `/api/market-pulse`
- Remove crypto from `/api/cron/prices`
- Remove `CryptoPrice`/`CryptoResponse` from `types/index.ts`

### 2.2 Silver Price Tracker
- Add silver to `lib/scrapers/gold.ts` (goldpricez.com supports silver — same API, different endpoint)
- Or create `lib/scrapers/silver.ts`
- Silver prices in PKR per tola (important for Zakat Nisab calculation)
- Add to `/api/gold` route (or create `/api/silver`)
- Add `silver_prices` table or reuse `gold_prices` with a `metal` column

### 2.3 Government Commodity Prices
- **Petrol/Diesel:** OGRA announces prices on 1st and 16th of each month. Scrape ogra.org.pk or hardcode + update via cron.
- **Grocery staples:** Flour (atta), sugar, ghee, cooking oil, rice, dal (pulses), chicken, eggs — PBS publishes weekly SPI (Sensitive Price Index). Scrape or use data.gov.pk.
- New table: `commodity_prices` (commodity_name, unit, price_pkr, effective_date, source, recorded_at)
- New scraper: `lib/scrapers/commodities.ts`
- New route: `/api/commodities`
- Add to daily cron

### 2.4 News Feed
- Free API options:
  - GNews (gnews.io) — 100 req/day free, Pakistani news supported
  - NewsData.io — 200 req/day free, Pakistan filter
  - MediaStack — 500 req/month free
- New table: `news_articles` (title, description, url, source_name, image_url, published_at, category, fetched_at)
- New scraper: `lib/scrapers/news.ts`
- New route: `/api/news`
- New component: `components/NewsFeed.tsx`
- Cache articles, fetch every hour via cron or on-demand with SWR
- Categories: economy, government, Islamic finance, gold, energy

### 2.5 Market Pulse Frontend Widget
- Unified card showing: Gold 24K/tola | Silver/tola | USD/PKR | Petrol | Next Draw
- Component: `components/MarketPulse.tsx`
- Place between StatsDashboard and DrawCountdown in app
- SWR with 60-second revalidation
- Update `/api/market-pulse` to include silver + commodities (remove crypto)

### 2.6 Price Alerts UI
- Backend exists (`/api/price-alerts`)
- Need frontend: dropdown for type (gold above/below, silver, USD, petrol), threshold input
- Alert list with delete
- Component: `components/PriceAlerts.tsx`

---

## Phase 3: Islamic Finance Hub — TODO

**Goal:** Be the go-to app for Islamic financial tools. Launch Zakat calc before Ramadan.

### 3.1 Zakat Calculator
- **Categories (all scholars agree on):**
  - Cash on hand + bank balances
  - Gold holdings (use live gold price from our API)
  - Silver holdings (use live silver price)
  - Prize bonds at face value
  - Business inventory/goods for sale
  - Rental income receivable
  - Debts owed to you
  - Minus: debts you owe
- **Auto Nisab:** Gold Nisab (~87.48g gold at live rate) and Silver Nisab (~612.36g silver at live rate)
- **Zakat rate:** 2.5% of net Zakatable assets above Nisab
- Lunar year tracking
- Save annually for comparison
- New table: `zakat_records`
- Component: `components/ZakatCalculator.tsx`
- Route: `/api/zakat`

### 3.2 Islamic Banking Explorer
- Scrape profit rates from: Meezan Bank, BankIslami, Al-Baraka, Dubai Islamic, MCB Islamic
- CDNS Islamic products: SISA (8.40%), SITA (10.80%)
- Show: bank name, product name, profit rate, maturity, min deposit
- New table: `islamic_bank_rates`
- New scraper: `lib/scrapers/islamic-banking.ts`
- Component: `components/IslamicBanking.tsx`
- Route: `/api/islamic-banking`

### 3.3 Halal Investment Guide
- Educational content: What makes an investment halal?
- Prize bonds: scholars' views (some debate, present both sides neutrally)
- Gold/silver as savings
- Islamic banking products explained
- What is NOT halal (interest, speculation, etc.)
- This is content, not a calculator — can be static pages

---

## Phase 4: Tax & Government — TODO

### 4.1 Income Tax Calculator
- Pakistan 2025-26 tax slabs (salaried + non-salaried)
- Common deductions and exemptions
- "Becoming a filer saves you Rs X on prize bonds" (15% vs 30%)
- Effective tax rate display
- Component: `components/IncomeTaxCalculator.tsx`

### 4.2 Government Scheme Tracker
- Consolidated dashboard: BISP/Ehsaas eligibility, Kamyab Jawan, PM Laptop, Naya Pakistan Housing
- Scrape eligibility criteria or hardcode
- "What schemes am I eligible for?" questionnaire
- Component: `components/GovtSchemes.tsx`

### 4.3 FBR Active Taxpayer Checker
- CNIC lookup against FBR Active Taxpayer List
- Show filer vs non-filer implications
- Guide to becoming a filer
- Component: `components/FbrChecker.tsx`

---

## Phase 5: Personal Finance — TODO

### 5.1 Bill Payment Tracker
- Track (not pay) utility bills: electricity (LESCO/MEPCO/etc.), gas (SNGPL/SSGC), water, PTCL
- Input consumer number, fetch amounts from public APIs
- Due date reminders, monthly trends
- New tables: `bill_accounts`, `bill_records`

### 5.2 Expense Tracker
- PKR-native with Pakistani categories: Grocery (kiryana), Transport (petrol/CNG/rickshaw), Utilities, School fees, Medical, Eid, Ramadan, Qurbani, Sadaqah
- Weekly/monthly reports
- New table: `expenses`

### 5.3 Halal Net Worth Dashboard
- Aggregate: prize bonds (face value) + gold/silver (live rates) + Islamic bank balances + property (manual)
- Minus: debts
- "Your halal net worth over time" chart
- No conventional bank balances or haram investments

---

## Phase 6: Infra & Scale — TODO

### 6.1 PWA
- manifest.json, service worker, offline fallback, install prompt
- Critical for Pakistani mobile users on slow data

### 6.2 Web Push Notifications
- VAPID (free, no Firebase)
- Triggers: draw results, wallet wins, draw reminders, price alerts, rate changes
- New table: `push_subscriptions`

### 6.3 Vercel KV
- Replace in-memory caches (rate limiter, stats cache)
- Persistent across cold starts

### 6.4 CDN Cache Headers
- s-maxage on API responses to cut function invocations

### 6.5 Public API v1
- `/api/v1/` with API key auth
- Monetize bond data + gold prices
- Tiers: Free, Basic, Pro

### 6.6 Events Aggregation
- Daily cron: roll up events into analytics_daily, prune old events

---

## Phase 7: Community & Education — TODO

### 7.1 Draw Day Live Feed
- Real-time checker count, anonymous winner celebrations
- FOMO drives invites

### 7.2 Islamic Financial Literacy
- Bite-sized education: "Understanding Zakat", "Is my investment halal?", "Prize bonds explained", "Why become a tax filer?"
- Quiz format, progress tracking
- Shareable certificates (WhatsApp viral)
- Aligned with SBP Financial Education Roadmap

### 7.3 News Integration
- If not done in Phase 2, add curated Pakistani economic news here

---

## Design System

### Colors
- Primary: `#0f172a` (slate-950)
- Background: `#f8fafc` (slate-50)
- Success: emerald-500/600
- Error: red-500
- Muted: gray-400/500
- Borders: gray-100/200

### Typography
- Sans: Inter (400-700)
- Mono: JetBrains Mono (400, 700) — numbers, prices, bond numbers
- Labels: `text-[10px] font-semibold text-gray-500 uppercase tracking-wider`

### Patterns
- Cards: `bg-white border border-gray-200 rounded-sm`
- Buttons: `bg-[#0f172a] text-white text-xs font-medium py-2.5 px-4 rounded-sm`
- Toggles: `bg-gray-100 rounded-sm overflow-hidden` with `bg-[#0f172a] text-white` active
- Numbers: `font-mono font-semibold`

---

## Dev Notes

1. **Next.js 16** — check `node_modules/next/dist/docs/` before writing. Breaking changes.
2. **Run migration:** `npx drizzle-kit push` before deploying.
3. **Vercel Pro needed** for multiple cron jobs ($20/mo).
4. **CRON_SECRET** env var required for cron auth.
5. **ClaimAssistant needs wiring** — component exists, no trigger button yet.
6. **Digital bond prize amounts are estimated** — update when CDNS confirms.
7. **Savings rates hardcoded** — update in `lib/scrapers/savings-rates.ts` when rates change.
8. **Draw schedule hardcoded for 2026** — needs yearly update.
9. **Rate limiter is in-memory** — resets on cold starts. Phase 6 (Vercel KV) fixes this.
10. **No user accounts** — fingerprint-based identity. Add optional accounts later.
11. **Consent check missing** — telemetry fires before consent. Fix before scaling.
12. **HALAL ONLY** — before adding any financial feature, ask: "Would this promote haram?" If yes, don't build it.
