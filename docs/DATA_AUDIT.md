# Data audit: current Neon database

Measured 2026-10-15 with read-only queries against the production `DATABASE_URL` (no writes). No personal data is reproduced here.

## 1. Tables present

| Table | Rows | In `lib/schema.ts`? | Notes |
|---|---|---|---|
| winners | 754,118 | yes | all prize bond data |
| events | 536 | yes | telemetry incl. IP, lat/lng, battery level (2026-04-05 to 2026-09-14) |
| devices | 11 | yes | fingerprints |
| wallet_bonds | 0 | yes | unused |
| wallet_notifications | 0 | yes | unused |
| draw_schedule | 40 | no | 2026 schedule, source `savings_gov_pk`, created 2026-04-11 |
| commodity_prices | 12 | no | petrol, diesel, atta (OGRA, PBS) |
| savings_rates | 11 | no | NSS certificate rates |
| gold_prices, exchange_rates, market_indices, news_articles, price_alerts, analytics_daily | 0 | no | empty |

Schema drift: nine tables exist that Drizzle does not know about (created out of band, probably by the deleted Python backend). There is no `drizzle.__drizzle_migrations` table, so migrations were applied with `drizzle-kit push`.

## 2. Prize bond coverage (`winners`)

Sources: `pkprizebond_com` 733,863 rows, `prizeinfo_net` 20,255 rows. Last insert 2026-04-05: the cron has not added anything for over six months.

Distinct draws after normalising dates (both sources combined):

| Denomination | First draw | Last draw | Draws | Draws with full list (pkprizebond) | Draws from prizeinfo (mostly 1st/2nd only) |
|---|---|---|---|---|---|
| 100 | 2013-02-15 | 2026-02-16 | 55 | 37 | 53 |
| 200 | 2000-03-15 | 2026-03-16 | 107 | 75 | 105 |
| 750 | 2000-01-15 | 2026-01-15 | 110 | 79 | 105 |
| 1500 | 2000-02-15 | 2026-02-16 | 109 | 80 | 105 |
| 7500 | 2000-02-01 | 2021-02-01 | 91 | 71 | 85 |
| 15000 | 2003-01-02 | 2021-04-01 | 71 | 71 | 0 |
| 25000 | 2012-05-02 | 2023-09-11 | 40 | 38 | 35 |
| 40000 | 2000-03-01 | 2023-09-11 | 92 | 74 | 78 |

Dates show as stored local midnight (+05:00), so UTC renders one day earlier in raw output; the table uses PKT dates.

Gaps:
- Full lists stop at Oct 2023 (pkprizebond). From Nov 2023 to Mar 2026 the 100/200/750/1500 denominations have 10 draws each but only about 2 with a full third-prize list; the rest are top prizes only.
- Nothing after March 2026, although draws continued (the official site already lists the Rs 750 draw of 15 October 2026 and Premium 40000 of 10 September 2026).
- No Premium 25000 or Premium 40000 denomination exists; their Sept 2023 draws appear to be stored under the bearer codes 25000/40000.
- No data for 1999 at all, and no Rs 100 data before 2013.
- Expected draws are about 4 per year per active denomination; 2000 to 2012 has roughly 40 to 46 draw-denomination pairs per year, consistent with 4 x 8 denominations only partly covered.

## 3. Correctness problems found

1. **Prize amounts are wrong for history.** Every row uses today's prize table (e.g. Rs 750 first prize Rs 1,500,000 for a draw in 2000). Amounts changed over the years; the scraper hard-codes `PRIZE_STRUCTURE`.
2. **Duplicate draws under two date formats.** `draw_date` is free text in two formats (`DD-Mon-YYYY` from pkprizebond and some prizeinfo rows, `D Month YYYY` from prizeinfo records). 523 draw-denomination pairs exist twice under different strings, and the unique key includes `source`, so the same draw is stored per source with no reconciliation.
3. **Multiple first prizes.** 17 draws have more than one distinct "1st" bond number.
4. **Cross-source conflicts on the first prize.** 4 draws where the two sources disagree, e.g. Rs 40000 on 2013-09-02 (`370987` vs `370978`, a likely transposition), Rs 1500 on 2010-11-15, Rs 40000 on 2016-03-01 and 2017-03-01.
5. **Mislabelled tiers.** 39 rows labelled 1st or 2nd carry the third-prize amount (e.g. Rs 100 "1st" with Rs 1,000); 5 bond numbers appear in two tiers of the same draw.
6. **Over-captured lists.** The parser takes every 6-digit token in a file. Median list sizes exceed the official counts (Rs 100: 1,228 vs 1,203 expected; Rs 200: 2,418 vs 2,400), so extra tokens (header numbers, amounts, draw metadata) are mixed into third-prize lists. One clear artefact: bond number `100000` appears twice.
7. **Truncated lists.** Some pkprizebond draws hold only 21 to 29 rows; 61 pkprizebond draws have no first prize at all.
8. **Draw numbers conflict.** 43 draws carry different draw numbers in the two sources.
9. **First-prize order assumption.** The TXT parser assumes the first number in the file is the first prize and the next N are second prizes, which breaks on any header or layout change.

## 4. Other findings

- `actions/scraper.ts` exports server actions that start scraping; server actions are publicly callable POST endpoints, so anyone can trigger scrapes. `app/admin` has no auth.
- `/api/cron/scrape` skips auth when `CRON_SECRET` is unset (fails open).
- `lib/rate-limit.ts` is in-memory and ineffective on serverless.
- `events` and `devices` store more personal data than the product needs.
- pkprizebond.com now returns HTTP 406 to scripted requests, so the 733,863-row snapshot is the only practical copy of its history: it must be preserved (`legacy_winners`) and not dropped before the backfill verifies coverage.
- The official site exposes a legacy draw-date list back to October 2012 for every denomination including Premium 25000/40000 (https://www.savings.gov.pk/latest/results.php), and current TXT/PDF files for about 15 recent draws per denomination.

## 5. What the backfill (Lane A1) must fix

1. Normalise dates to `date`, one row per (denomination, draw) in `draws`, with draw number and city reconciled from official lists and prizeinfo.
2. Split premium 25000/40000 into their own denominations.
3. Parse prize amounts and counts per draw; store in `draw_prizes`; validate counts.
4. Re-parse legacy lists with tier-aware rules; drop tokens that are not winning numbers; flag truncated lists as `top` or `none` completeness rather than `full`.
5. Resolve the 17 multi-first draws, 4 cross-source conflicts, 39 mislabelled rows and 43 draw-number conflicts, or mark them `disputed` with an issue.
6. Fetch official TXT/PDF for every draw they cover (2019 onward) and verify or replace legacy data.
7. Fill Nov 2023 to Oct 2026 full lists from official files.
8. Produce `docs/COVERAGE.md`: per denomination and year from 1999, expected vs full/top/none, verified vs disputed.
9. Move `draw_schedule` into `draws`; drop out-of-band empty tables; drop `devices`/`events`.
