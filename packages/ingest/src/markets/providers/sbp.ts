import { pdfLines } from "../pdf-text";
import { ParseError, type PkrQuote, type PriceProvider, type ProviderContext } from "../types";

/**
 * State Bank of Pakistan rate sheets. The economic data index links the latest PDF of each
 * daily sheet; the parsers read the PDFs with the dependency free extractor in `pdf-text.ts`.
 * The index sits behind a Cloudflare challenge that answers 403 to every non-browser client, while
 * the PDFs themselves are served openly under fixed names, so when the index cannot be read the
 * sheet is fetched by its dated name instead (`sheetUrls`).
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

type SheetKey = keyof SbpSheetLinks;

/** File name stems and the month casing SBP uses for each sheet (M2M is all lower case). */
const SHEETS: Record<SheetKey, { stem: string; lowerMonth: boolean }> = {
  wacer: { stem: "weighted-average-customer-exchange-rates", lowerMonth: false },
  m2m: { stem: "mark-to-market-revaluation-exchange-rate", lowerMonth: true },
  ecap: { stem: "open-market-closing-exchange-rates", lowerMonth: false },
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * The dated PDF addresses of a sheet for one day, SBP's usual casing first and the other one as a
 * fallback, e.g. `.../weighted-average-customer-exchange-rates-15-October-2026.pdf`.
 */
export function sheetUrls(sheet: SheetKey, isoDate: string): string[] {
  const [y, m, d] = isoDate.split("-").map(Number);
  const month = MONTH_NAMES[m! - 1]!;
  const { stem, lowerMonth } = SHEETS[sheet];
  const url = (name: string) => `https://www.sbp.org.pk/assets/document/${stem}-${d}-${name}-${y}.pdf`;
  return lowerMonth ? [url(month.toLowerCase()), url(month)] : [url(month), url(month.toLowerCase())];
}

/** Pakistan working days (Monday to Friday) from today backwards, newest first. */
export function recentWorkingDays(now: Date, count = 4): string[] {
  const days: string[] = [];
  // Pakistan is UTC+5 all year.
  const day = new Date(now.getTime() + 5 * 3_600_000);
  for (let i = 0; days.length < count && i < 14; i++) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return days;
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

// One index download per job run, even when several sheets are read.
const linkCache = new WeakMap<object, Promise<SbpSheetLinks>>();

/** The links on the index, or none when it cannot be read (the dated names are tried instead). */
function sheetLinks(ctx: ProviderContext): Promise<SbpSheetLinks> {
  let pending = linkCache.get(ctx.fetcher);
  if (!pending) {
    pending = ctx.fetcher
      .get(SBP_INDEX_URL, { headers: { Accept: "text/html" } })
      .then((res) => (res.ok ? parseSbpIndex(res.body) : {}))
      .catch(() => ({}));
    linkCache.set(ctx.fetcher, pending);
  }
  return pending;
}

/**
 * The text lines of the newest copy of a sheet: the PDF the index links, else the dated names of
 * the last few working days, newest first. Throws with every address tried when none is found.
 */
async function sheetLines(ctx: ProviderContext, sheet: SheetKey, source: string): Promise<string[]> {
  const linked = (await sheetLinks(ctx))[sheet];
  const candidates = [...new Set([...(linked ? [linked] : []), ...recentWorkingDays(ctx.now).flatMap((d) => sheetUrls(sheet, d))])];
  const tried: string[] = [];
  for (const url of candidates) {
    const res = await ctx.fetcher.get(url, { bytes: true, headers: { Accept: "application/pdf" } });
    if (res.ok && res.data) return pdfLines(res.data);
    tried.push(`${res.status} ${url}`);
  }
  throw new ParseError(source, `no sheet found (${tried.join("; ")})`);
}

/** Interbank buying and selling (primary). */
export const sbpWacerProvider: PriceProvider<PkrQuote[]> = {
  id: "sbp-wacer",
  dataset: "pkr-interbank",
  enabled: () => true,
  async fetch(ctx) {
    const sheet = parseBuySellSheet(await sheetLines(ctx, "wacer", "sbp-wacer"), "sbp-wacer");
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
    const sheet = parseM2mSheet(await sheetLines(ctx, "m2m", "sbp-m2m"));
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
    const sheet = parseBuySellSheet(await sheetLines(ctx, "ecap", "sbp-ecap"), "sbp-ecap");
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
