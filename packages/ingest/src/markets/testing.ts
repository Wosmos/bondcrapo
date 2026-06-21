import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Fetcher } from "../fetcher";

/** Test helpers: recorded fixtures served by URL through a fake `fetch`. Never used at runtime. */
export const FIXTURES = fileURLToPath(new URL("../../fixtures/markets/", import.meta.url));

export const fixture = (path: string) => readFileSync(FIXTURES + path);
export const fixtureText = (path: string) => readFileSync(FIXTURES + path, "utf8");
export const fixtureJson = (path: string): unknown => JSON.parse(fixtureText(path));

type Route = string | (() => Response);

/** URL to fixture path (or a function returning a Response, e.g. a 500). Unknown URLs answer 404. */
export const DEFAULT_ROUTES: Record<string, Route> = {
  "https://api.gold-api.com/price/XAU": "gold-api/price-XAU.json",
  "https://api.gold-api.com/price/XAG": "gold-api/price-XAG.json",
  "https://api.gold-api.com/price/XPT": "gold-api/price-XPT.json",
  "https://api.gold-api.com/price/XPD": "gold-api/price-XPD.json",
  "https://api.metalpriceapi.com/v1/latest?base=USD&currencies=XAU,XAG,XPT,XPD": "metalpriceapi/latest-docs-example.json",
  "https://open.er-api.com/v6/latest/USD": "er-api/latest-USD.json",
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json": "currency-api/latest-usd.json",
  "https://www.sbp.org.pk/ecodata/index2.asp": "sbp/index2-excerpt.html",
  "https://www.sbp.org.pk/assets/document/weighted-average-customer-exchange-rates-15-October-2026.pdf":
    "sbp/weighted-average-customer-exchange-rates-15-October-2026.pdf",
  "https://www.sbp.org.pk/assets/document/mark-to-market-revaluation-exchange-rate-15-october-2026.pdf":
    "sbp/mark-to-market-revaluation-exchange-rate-15-october-2026.pdf",
  "https://www.sbp.org.pk/assets/document/open-market-closing-exchange-rates-15-October-2026.pdf":
    "sbp/open-market-closing-exchange-rates-15-October-2026.pdf",
  "https://www.forex.pk/open_market_rates.asp": "forex-pk/open-market-rates.html",
  "https://www.app.com.pk/wp-json/wp/v2/posts?search=gold%20tola&per_page=10&_fields=id,date,link,title,content":
    "app/posts-search-gold-tola.json",
};

const DATED = /currency-api@(\d{4}-\d{2}-\d{2})\/v1\/currencies\/usd\.min\.json$/;

export function fixtureFetch(overrides: Record<string, Route | null> = {}) {
  const routes: Record<string, Route | null> = { ...DEFAULT_ROUTES, ...overrides };
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    let route = routes[url];
    const dated = DATED.exec(url);
    if (route === undefined && dated) {
      try {
        readFileSync(`${FIXTURES}currency-api/history/${dated[1]}.json`);
        route = `currency-api/history/${dated[1]}.json`;
      } catch {
        route = null;
      }
    }
    if (typeof route === "function") return route();
    if (!route) return new Response("not found", { status: 404 });
    const type = route.endsWith(".pdf") ? "application/pdf" : route.endsWith(".html") ? "text/html" : "application/json";
    return new Response(new Uint8Array(fixture(route)), { status: 200, headers: { "content-type": type } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

export function fixtureFetcher(overrides: Record<string, Route | null> = {}) {
  const { fn, calls } = fixtureFetch(overrides);
  const fetcher = new Fetcher({ userAgent: "BondCheckTest/1.0", fetch: fn, sleep: async () => undefined, baseBackoffMs: 1 });
  return { fetcher, calls };
}
