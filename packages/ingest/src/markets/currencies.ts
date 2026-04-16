/**
 * ISO 4217 currencies we store reference rates for: the set ExchangeRate-API publishes
 * (recorded 2026-10-15). The currency-api files also carry crypto tokens; this list keeps them out.
 */
export const FX_CURRENCIES = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD",
  "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN",
  "BZD", "CAD", "CDF", "CHF", "CLF", "CLP", "CNH", "CNY", "COP", "CRC", "CUP", "CVE",
  "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "FOK",
  "GBP", "GEL", "GGP", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK",
  "HTG", "HUF", "IDR", "ILS", "IMP", "INR", "IQD", "IRR", "ISK", "JEP", "JMD", "JOD",
  "JPY", "KES", "KGS", "KHR", "KID", "KMF", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP",
  "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU",
  "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD",
  "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB",
  "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD",
  "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TVD",
  "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF",
  "XCD", "XCG", "XDR", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWG", "ZWL",
] as const;

export type FxCurrency = (typeof FX_CURRENCIES)[number];

const SET = new Set<string>(FX_CURRENCIES);
export const isFxCurrency = (code: string): code is FxCurrency => SET.has(code);

/** Currencies offered first in selectors and prebuilt as /currency/{code}-to-pkr pages. */
export const POPULAR_PKR_PAIRS = [
  "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "CNY", "JPY", "KWD", "QAR", "OMR", "BHD", "MYR", "TRY", "CHF",
] as const;
