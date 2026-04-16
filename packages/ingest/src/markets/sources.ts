/**
 * Every market number carries the id of the source it came from (the `source` column). This
 * registry turns ids into the attribution shown next to the number and returned in API `meta`
 * (licence terms: ExchangeRate-API requires "Rates By Exchange Rate API").
 */
export interface MarketSource {
  name: string;
  url: string;
  /** Attribution line, shown verbatim. */
  text: string;
  /** How the number came about. "reported" sources publish the figure we show. */
  nature: "reported" | "reference" | "estimate";
}

export const MARKET_SOURCES = {
  "gold-api": {
    name: "Gold API",
    url: "https://gold-api.com",
    text: "International spot prices from gold-api.com",
    nature: "reference",
  },
  metalpriceapi: {
    name: "MetalpriceAPI",
    url: "https://metalpriceapi.com",
    text: "International spot prices from MetalpriceAPI",
    nature: "reference",
  },
  "er-api": {
    name: "ExchangeRate-API",
    url: "https://www.exchangerate-api.com",
    text: "Rates By Exchange Rate API",
    nature: "reference",
  },
  "currency-api": {
    name: "currency-api",
    url: "https://github.com/fawazahmed0/exchange-api",
    text: "Daily reference rates from the free currency-api by Fawaz Ahmed (CC0)",
    nature: "reference",
  },
  "sbp-wacer": {
    name: "State Bank of Pakistan",
    url: "https://www.sbp.org.pk/ecodata/index2.asp",
    text: "Weighted average customer exchange rates published by the State Bank of Pakistan",
    nature: "reported",
  },
  "sbp-m2m": {
    name: "State Bank of Pakistan",
    url: "https://www.sbp.org.pk/ecodata/index2.asp",
    text: "Mark to market (closing interbank) rates published by the State Bank of Pakistan",
    nature: "reported",
  },
  "sbp-ecap": {
    name: "ECAP via State Bank of Pakistan",
    url: "https://www.sbp.org.pk/ecodata/index2.asp",
    text: "Open market closing rates of the Exchange Companies Association of Pakistan, published by the State Bank of Pakistan",
    nature: "reported",
  },
  "forex-pk": {
    name: "Forex.pk",
    url: "https://www.forex.pk/open_market_rates.asp",
    text: "Open market rates as published by Forex.pk",
    nature: "reported",
  },
  "app-apsgja": {
    name: "APSGJA via APP",
    url: "https://www.app.com.pk/business/",
    text: "Rates issued by the All Pakistan Sarafa Gems and Jewellers Association, as reported by the Associated Press of Pakistan",
    nature: "reported",
  },
  "apsgja-purity": {
    name: "BondCheck calculation",
    url: "https://www.app.com.pk/business/",
    text: "Calculated from the APSGJA 24 karat rate by purity (karat / 24)",
    nature: "estimate",
  },
  freegoldapi: {
    name: "FreeGoldAPI",
    url: "https://freegoldapi.com",
    text: "Long run monthly gold history compiled by FreeGoldAPI.com (World Bank Pink Sheet)",
    nature: "reference",
  },
  derived: {
    name: "BondCheck estimate",
    url: "https://gold-api.com",
    text: "Estimated from the international spot price, the exchange rate and purity; excludes making charges and taxes",
    nature: "estimate",
  },
} as const satisfies Record<string, MarketSource>;

export type MarketSourceId = keyof typeof MARKET_SOURCES;

export const isMarketSourceId = (id: string): id is MarketSourceId => id in MARKET_SOURCES;

export interface Attribution {
  name: string;
  url?: string;
  text: string;
}

/** Unique attribution entries for the sources behind a response, in first seen order. */
export function attributionFor(ids: Iterable<string>): Attribution[] {
  const seen = new Set<string>();
  const out: Attribution[] = [];
  for (const id of ids) {
    if (seen.has(id) || !isMarketSourceId(id)) continue;
    seen.add(id);
    const s = MARKET_SOURCES[id];
    out.push({ name: s.name, url: s.url, text: s.text });
  }
  return out;
}
