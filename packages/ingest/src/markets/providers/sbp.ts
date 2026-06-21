import { pdfLines } from "../pdf-text";
import { ParseError, type PkrQuote, type PriceProvider, type ProviderContext } from "../types";

/**
 * State Bank of Pakistan rate sheets. The economic data index links the latest PDF of each
 * daily sheet; the parsers read the PDFs with the dependency free extractor in `pdf-text.ts`.
 *   - Weighted Average Customer Exchange Rates (WACER): interbank buying and selling, 10 currencies.
 *   - Mark to Market revaluation rates (M2M): closing interbank READY rate, about 35 currencies.
 *   - ECAP open market closing rates, published by SBP: buying and selling, 6 currencies.
 */
export const SBP_INDEX_URL = "https://www.sbp.org.pk/ecodata/index2.asp";

export interface SbpSheetLinks {
  wacer?: string;
  m2m?: string;
  ecap?: string;
}

export function parseSbpIndex(html: string): SbpSheetLinks {
  const find = (stem: string) => {
    const m = new RegExp(`href="(https://www\\.sbp\\.org\\.pk/assets/document/${stem}-[^"]+\\.pdf)"`, "i").exec(html);
    return m?.[1];
  };
  return {
    wacer: find("weighted-average-customer-exchange-rates"),
    m2m: find("mark-to-market-revaluation-exchange-rate"),
    ecap: find("open-market-closing-exchange-rates"),
  };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Finds the sheet date: `15-Oct-26`, `15-October-2026` or `October 15, 2026`. */
export function parseSheetDate(text: string): string | null {
  let m = /(\d{1,2})-([A-Za-z]{3,9})-(\d{2,4})\b/.exec(text);
  let day: number, mon: number, year: number;
  if (m) {
    day = Number(m[1]);
    mon = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase());
    year = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
  } else {
    m = /\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b/.exec(text);
    if (!m) return null;
    mon = MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase());
    day = Number(m[2]);
    year = Number(m[3]);
  }
  if (mon < 0 || day < 1 || day > 31 || year < 2000) return null;
  return `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface BuySellSheet {
  date: string;
  rows: { currency: string; buy: number; sell: number }[];
}

const NUM = String.raw`(\d{1,5}(?:\.\d+)?)`;

/** WACER and ECAP sheets: `CUR  buying  selling` rows. */
export function parseBuySellSheet(lines: string[], source: string): BuySellSheet {
  const header = lines.slice(0, 8).join(" ");
  const date = parseSheetDate(header);
  if (!date) throw new ParseError(source, "sheet date not found");
  const rows: BuySellSheet["rows"] = [];
  const re = new RegExp(String.raw`^([A-Z]{3})\s+${NUM}\s+${NUM}$`);
  for (const line of lines) {
    const m = re.exec(line.trim());
    if (!m) continue;
    rows.push({ currency: m[1]!, buy: Number(m[2]), sell: Number(m[3]) });
  }
  if (!rows.some((r) => r.currency === "USD")) throw new ParseError(source, "no USD row");
  return { date, rows };
}

export interface M2mSheet {
  date: string;
  rows: { currency: string; ready: number }[];
}

/** M2M sheet: `CUR  READY  1-WEEK ...`; only READY (spot) is used, 0.0000 means not available. */
export function parseM2mSheet(lines: string[]): M2mSheet {
  const date = parseSheetDate(lines.slice(0, 4).join(" "));
  if (!date) throw new ParseError("sbp-m2m", "sheet date not found");
  const rows: M2mSheet["rows"] = [];
  for (const line of lines) {
    const m = new RegExp(String.raw`^([A-Z]{3})\s+${NUM}(\s|$)`).exec(line.trim());
    if (!m) continue;
    const ready = Number(m[2]);
    if (ready > 0) rows.push({ currency: m[1]!, ready });
  }
  if (!rows.some((r) => r.currency === "USD")) throw new ParseError("sbp-m2m", "no USD row");
  return { date, rows };
}

/** SBP publishes in the afternoon, Pakistan time: 16:00 PKT is used as the observation time. */
const observedOn = (date: string) => new Date(`${date}T11:00:00Z`);

async function fetchPdfLines(ctx: ProviderContext, url: string, source: string): Promise<string[]> {
  const res = await ctx.fetcher.get(url, { bytes: true, headers: { Accept: "application/pdf" } });
  if (!res.ok || !res.data) throw new ParseError(source, `HTTP ${res.status}`);
  return pdfLines(res.data);
}

// One index download per job run, even when several sheets are read.
const linkCache = new WeakMap<object, Promise<SbpSheetLinks>>();

function sheetLinks(ctx: ProviderContext): Promise<SbpSheetLinks> {
  let pending = linkCache.get(ctx.fetcher);
  if (!pending) {
    pending = ctx.fetcher.get(SBP_INDEX_URL, { headers: { Accept: "text/html" } }).then((res) => {
      if (!res.ok) throw new ParseError("sbp", `index HTTP ${res.status}`);
      return parseSbpIndex(res.body);
    });
    pending.catch(() => linkCache.delete(ctx.fetcher));
    linkCache.set(ctx.fetcher, pending);
  }
  return pending;
}

/** Interbank buying and selling (primary). */
export const sbpWacerProvider: PriceProvider<PkrQuote[]> = {
  id: "sbp-wacer",
  dataset: "pkr-interbank",
  enabled: () => true,
  async fetch(ctx) {
    const url = (await sheetLinks(ctx)).wacer;
    if (!url) throw new ParseError("sbp-wacer", "sheet link not found on the index");
    const sheet = parseBuySellSheet(await fetchPdfLines(ctx, url, "sbp-wacer"), "sbp-wacer");
    return sheet.rows.map((r) => ({
      currency: r.currency,
      date: sheet.date,
      kind: "interbank" as const,
      buy: r.buy,
      sell: r.sell,
      observedAt: observedOn(sheet.date),
      source: "sbp-wacer" as const,
    }));
  },
};

/** Interbank closing READY rate (fallback): one mid rate, stored as buy = sell. */
export const sbpM2mProvider: PriceProvider<PkrQuote[]> = {
  id: "sbp-m2m",
  dataset: "pkr-interbank",
  enabled: () => true,
  async fetch(ctx) {
    const url = (await sheetLinks(ctx)).m2m;
    if (!url) throw new ParseError("sbp-m2m", "sheet link not found on the index");
    const sheet = parseM2mSheet(await fetchPdfLines(ctx, url, "sbp-m2m"));
    return sheet.rows.map((r) => ({
      currency: r.currency,
      date: sheet.date,
      kind: "interbank" as const,
      buy: r.ready,
      sell: r.ready,
      observedAt: observedOn(sheet.date),
      source: "sbp-m2m" as const,
    }));
  },
};

/** ECAP open market closing rates (fallback for the open market). */
export const sbpEcapProvider: PriceProvider<PkrQuote[]> = {
  id: "sbp-ecap",
  dataset: "pkr-open-market",
  enabled: () => true,
  async fetch(ctx) {
    const url = (await sheetLinks(ctx)).ecap;
    if (!url) throw new ParseError("sbp-ecap", "sheet link not found on the index");
    const sheet = parseBuySellSheet(await fetchPdfLines(ctx, url, "sbp-ecap"), "sbp-ecap");
    return sheet.rows.map((r) => ({
      currency: r.currency,
      date: sheet.date,
      kind: "open_market" as const,
      buy: r.buy,
      sell: r.sell,
      observedAt: observedOn(sheet.date),
      source: "sbp-ecap" as const,
    }));
  },
};
