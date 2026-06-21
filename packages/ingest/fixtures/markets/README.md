# Market source fixtures

Responses recorded from the public sources on 2026-10-15 between 20:34 and 20:42 UTC with one
polite request per URL (User-Agent `BondCheckBot/1.0`, two seconds apart). Tests read these files
through a fake `fetch`; no test touches the network.

| File | Source URL | Notes |
|---|---|---|
| `gold-api/price-{XAU,XAG,XPT,XPD}.json` | `https://api.gold-api.com/price/{symbol}` | verbatim |
| `er-api/latest-USD.json` | `https://open.er-api.com/v6/latest/USD` | verbatim |
| `currency-api/latest-usd.json` | `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json` | verbatim |
| `currency-api/2024-03-06-usd.min.json` | same package at `@2024-03-06`, `usd.min.json` | verbatim, first weeks of the dated releases |
| `currency-api/history/*.json` | same package at `@<date>` for 2026-08-31 to 2026-10-14 | trimmed to the ISO currencies in `src/markets/currencies.ts` plus XAU, XAG, XPT, XPD (the files also list about 200 crypto tokens) |
| `sbp/index2-excerpt.html` | `https://www.sbp.org.pk/ecodata/index2.asp` | excerpt: only the three rate sheet anchors are kept (the page is 570 KB) |
| `sbp/*.pdf` | the three PDFs linked from that index | verbatim |
| `forex-pk/open-market-rates.html` | `https://www.forex.pk/open_market_rates.asp` | verbatim |
| `app/posts-search-gold-tola.json` | `https://www.app.com.pk/wp-json/wp/v2/posts?search=gold%20tola&per_page=10&_fields=id,date,link,title,content` | verbatim |
| `freegoldapi/latest-excerpt.json` | `https://freegoldapi.com/data/latest.json` | excerpt: rows from 2023 on |
| `metalpriceapi/latest-docs-example.json` | `https://metalpriceapi.com/documentation` (Live Rates example) | the documented example response; the API needs a key, so no live response was recorded |
| `metalpriceapi/error-invalid-key.json` | same documentation (API Error Codes) | documented error shape |

To refresh a fixture, fetch the URL once with the same User-Agent and keep the date in the file name
when the source publishes dated documents.
