# Prize bond coverage report

Generated on 2026-06-11 by `pnpm --filter @bondcheck/ingest coverage:bonds` from the `draws`, `draw_sources` and `source_documents` tables. The same numbers are served by `GET /api/v1/bonds/coverage` and the /prize-bonds/coverage page.

This report was produced by a dry run: documents were fetched live, the legacy snapshot was read from the production database without writing, and the reconciled draws were written to a throwaway in-memory database. It shows what the backfill will publish.

Legend: **expected** draws held in the year (catalogued draws, and at least the denomination's draws per year between its first and last year); **full** first, second and third prize lists; **top** first and second prizes only; **none** nothing published; **verified** two independent sources agree on the top prizes, or an official file for draws since 2019; **disputed** valid sources disagree (the draw page lists them).

## Summary

| Denomination | Years | Expected | Full | Top | None | Verified | Disputed |
|---|---|---:|---:|---:|---:|---:|---:|
| Rs 100 | 2013 to 2026 | 56 | 46 | 9 | 1 | 50 | 0 |
| Rs 200 | 2000 to 2026 | 108 | 57 | 20 | 31 | 63 | 5 |
| Rs 750 | 2000 to 2026 | 108 | 59 | 49 | 0 | 86 | 1 |
| Rs 1,500 | 2000 to 2026 | 107 | 57 | 50 | 0 | 84 | 4 |
| Rs 25,000 Premium | 2021 to 2026 | 23 | 22 | 1 | 0 | 22 | 0 |
| Rs 40,000 Premium | 2017 to 2026 | 38 | 28 | 10 | 0 | 28 | 0 |
| Rs 7,500 | 2000 to 2021 | 85 | 34 | 51 | 0 | 64 | 1 |
| Rs 15,000 | 2000 to 2021 | 86 | 39 | 47 | 0 | 64 | 3 |
| Rs 25,000 | 2012 to 2020 | 35 | 30 | 5 | 0 | 32 | 1 |
| Rs 40,000 | 2000 to 2019 | 78 | 34 | 44 | 0 | 59 | 1 |

## Per year

Each cell is `full/top/none` of expected draws; `-` means no draw expected that year.

| Year | Rs 100 | Rs 200 | Rs 750 | Rs 1,500 | Rs 25,000 Premium | Rs 40,000 Premium | Rs 7,500 | Rs 15,000 | Rs 25,000 | Rs 40,000 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1999 (no source) | - | - | - | - | - | - | - | - | - | - |
| 2000 | - | 0/3/1 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2001 | - | 0/0/4 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2002 | - | 0/0/4 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2003 | - | 0/2/2 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2004 | - | 0/0/4 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2005 | - | 0/0/4 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2006 | - | 0/0/4 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2007 | - | 0/0/4 | 0/4/0 | 0/4/0 | - | - | 0/4/0 | 0/4/0 | - | 0/4/0 |
| 2008 | - | 2/0/2 | 1/3/0 | 1/3/0 | - | - | 0/4/0 | 1/3/0 | - | 2/2/0 |
| 2009 | - | 2/2/0 | 4/0/0 | 3/1/0 | - | - | 4/0/0 | 4/0/0 | - | 3/1/0 |
| 2010 | - | 0/4/0 | 1/3/0 | 0/4/0 | - | - | 0/4/0 | 1/3/0 | - | 1/3/0 |
| 2011 | - | 2/2/0 | 2/2/0 | 1/3/0 | - | - | 1/3/0 | 3/1/0 | - | 4/0/0 |
| 2012 | - | 2/2/0 | 4/0/0 | 4/0/0 | - | - | 3/1/0 | 4/0/0 | 2/1/0 | 3/1/0 |
| 2013 | 3/1/0 | 2/1/1 | 2/2/0 | 3/1/0 | - | - | 4/0/0 | 4/0/0 | 4/0/0 | 3/1/0 |
| 2014 | 3/1/0 | 4/0/0 | 4/0/0 | 4/0/0 | - | - | 3/1/0 | 4/0/0 | 3/1/0 | 4/0/0 |
| 2015 | 4/0/0 | 3/1/1 | 4/0/0 | 3/1/0 | - | - | 3/1/0 | 4/0/0 | 4/0/0 | 4/0/0 |
| 2016 | 2/2/0 | 2/2/0 | 3/1/0 | 2/2/0 | - | - | 2/2/0 | 3/1/0 | 3/1/0 | 1/3/0 |
| 2017 | 2/2/0 | 3/1/0 | 2/2/0 | 3/1/0 | - | 0/3/0 | 2/2/0 | 2/2/0 | 3/1/0 | 3/1/0 |
| 2018 | 3/1/0 | 4/0/0 | 4/0/0 | 4/0/0 | - | 0/4/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 |
| 2019 | 4/0/1 | 4/0/0 | 4/0/0 | 4/0/0 | - | 4/0/0 | 4/0/0 | 3/1/0 | 3/1/0 | 2/0/0 |
| 2020 | 3/1/0 | 4/0/0 | 4/0/0 | 4/0/0 | - | 4/0/0 | 3/1/0 | 1/3/0 | 4/0/0 | - |
| 2021 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 1/0/0 | 1/1/0 | - | - |
| 2022 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | - | - | - | - |
| 2023 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 3/1/0 | 3/1/0 | - | - | - | - |
| 2024 | 4/0/0 | 4/0/0 | 2/2/0 | 4/0/0 | 4/0/0 | 4/0/0 | - | - | - | - |
| 2025 | 3/1/0 | 4/0/0 | 3/1/0 | 3/1/0 | 4/0/0 | 3/1/0 | - | - | - | - |
| 2026 | 3/0/0 | 3/0/0 | 3/1/0 | 2/1/0 | 3/0/0 | 2/1/0 | - | - | - | - |

## Data audit findings

Draws named in docs/DATA_AUDIT.md section 3 (multiple first prizes and cross-source conflicts) and how they ended up.

| Denomination | Draw date | Finding | Status | Completeness | Primary source |
|---|---|---|---|---|---|
| Rs 100 | 2025-08-15 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 100 | 2026-02-16 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 200 | 2003-12-15 | two first prizes in the pkprizebond list | published | none | legacy snapshot (prizeinfo.net rows) |
| Rs 200 | 2023-12-15 | two first prizes (scraper artefact 003542) | verified | full | official PDF |
| Rs 200 | 2024-03-15 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 750 | 2024-01-15 | two first prizes (scraper artefact 003542) | published | top | legacy snapshot (prizeinfo.net rows) |
| Rs 750 | 2025-01-15 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 750 | 2026-01-15 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 1,500 | 2025-08-15 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 1,500 | 2024-02-15 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 1,500 | 2010-11-15 | sources disagree on the first prize (209637 vs 397799) | disputed | top | legacy snapshot (pkprizebond.com rows) |
| Rs 1,500 | 2026-02-16 | two first prizes (scraper artefact 003542) | verified | full | official TXT |
| Rs 1,500 | 2014-02-17 | two first prizes in the pkprizebond list | published | full | legacy snapshot (prizeinfo.net rows) |
| Rs 40,000 | 2016-03-01 | sources disagree on the first prize (592635 vs 190031) | verified | top | legacy snapshot (prizeinfo.net rows) |
| Rs 40,000 | 2017-03-01 | sources disagree on the first prize (669572 vs 035150) | verified | top | legacy snapshot (prizeinfo.net rows) |
| Rs 40,000 | 2014-09-01 | two first prizes in the pkprizebond list | published | full | legacy snapshot (prizeinfo.net rows) |
| Rs 40,000 | 2013-09-02 | sources disagree on the first prize (370987 vs 370978) | verified | top | legacy snapshot (prizeinfo.net rows) |

## Method

1. Sources, in precedence order: official National Savings result files (TXT, then PDF text), the official draw date list and number search (www.savings.gov.pk/latest/results.php), the legacy database snapshot of pkprizebond.com and prizeinfo.net rows, and the prizeinfo.net first and second prize records and schedules. Every document is stored with its URL, fetch time and sha256 and linked to the draws it supports.
2. Parsers locate prize sections by their headings; numbers in prose, headers and amounts are never collected. Prize amounts and counts are read from each document; the reference prize table is used only when a document states none, and such amounts are marked as inferred.
3. Validation: six digit numbers, no duplicates, one tier per number, and tier counts equal to the document header or the reference (1, 3 and 1696 for most bearer bonds, 1, 5 and 2394 for Rs 200, 1, 3 and 1199 for Rs 100, 2, 5 and 700 for Premium 25000, 1, 3 and 660 for Premium 40000). A list that fails is not published.
4. Legacy snapshot cleaning: both date spellings are normalised; Premium 25000 and 40000 draws stored under the bearer codes are split by date; 25 numbers repeated in about 525 pkprizebond.com lists and `003542` repeated as a first prize by the prizeinfo.net scraper are removed as artefacts (a real number wins at most a handful of times in 25 years). After cleaning, the pkprizebond.com lists match the official files exactly wherever both exist.
5. Draws are matched across sources by denomination and date within 10 days (sources disagree by a few days, for example 01-Dec-2017 against 04-Dec-2017). A date found only in the legacy snapshot, with no official or prizeinfo.net record, is rejected as a mislabelled list.
6. When valid sources disagree on the first prize, the official number search is asked about each disputed number. The 1999 draws and the Rs 100 draws before February 2013 have no machine readable source; they are listed as `no source` until newspaper archives are entered by hand.
7. The legacy `draw_schedule` table is not imported: its draw numbers disagree with the official files (for example the Rs 100 draw of 15 May 2026 is draw 54 in the official file and 48 in that table). The calendar comes from the official date lists and the prizeinfo.net schedules instead.

Third-party data is used to fill gaps and to corroborate, with attribution: pkprizebond.com (through the legacy snapshot only; the site is not scraped) and prizeinfo.net.
