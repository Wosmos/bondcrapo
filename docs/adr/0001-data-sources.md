# ADR 0001: Data sources and precedence

Status: accepted, 2026-10-15

## Context
The current database mixes two third-party scrapes (pkprizebond.com, prizeinfo.net), assumes a constant prize table, and has no market data. We need correct, attributable data for prize bonds since 1999 and for metals and FX.

## Decision
Prize bonds, in precedence order:
1. Official National Savings files (TXT, then PDF) from the denomination pages, e.g. https://savings.gov.pk/rs-750-prize-bond-draw (about the last 15 draws per denomination).
2. Official legacy search (https://www.savings.gov.pk/latest/results.php, date lists via `ajaxData.php`): draw catalog back to October 2012 and spot verification of top prizes. Not used for bulk download.
3. Legacy DB snapshot of pkprizebond.com full lists (Jan 2000 to Oct 2023). The live site now rejects scripted requests (HTTP 406), so the snapshot is preserved as `legacy_winners` and imported with provenance `legacy_db_snapshot`.
4. prizeinfo.net first/second records and schedules for corroboration.
5. Manual entry (double-keyed) from newspaper archives for 1999 and unrecoverable gaps.

Prize amounts are parsed per document; `prize_structures` is a validation reference only.

Markets:
- Metal spot: gold-api.com (https://gold-api.com/docs) primary; MetalpriceAPI or GoldAPI.io with a free key as fallback.
- FX reference: ExchangeRate-API Open Access (https://www.exchangerate-api.com/docs/free, attribution required); history and fallback from fawazahmed0 currency-api (CC0, https://github.com/fawazahmed0/exchange-api).
- PKR interbank: State Bank of Pakistan (https://www.sbp.org.pk/ecodata/index2.asp). PKR open market: Forex Association of Pakistan via https://www.forex.pk/, fallback APP news wire.
- Pakistan retail gold: APSGJA rates as reported by APP (https://www.app.com.pk/), validated against a derived value; other countries derived and labelled "estimated" until a licensed reported source is added.

## Consequences
Every published number carries a source and a kind (reported or derived). Third-party compilations are a gap filler, which lowers ToS risk. 1999 coverage depends on manual work.
