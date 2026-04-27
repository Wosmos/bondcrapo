import { ParseError, type PkrQuote, type PriceProvider } from "../types";
import { htmlToText } from "./html";

export const FOREX_PK_URL = "https://www.forex.pk/open_market_rates.asp";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** `as on Thu, Oct 15 2026, 15:22 PST (GMT+5)` (PST here is Pakistan Standard Time). */
export function parseForexPkTimestamp(text: string): Date | null {
  const m = /as on\s+\w{3},\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4}),\s+(\d{1,2}):(\d{2})/i.exec(text);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1]!.toLowerCase());
  if (mon < 0) return null;
  const iso = `${m[3]}-${String(mon + 1).padStart(2, "0")}-${m[2]!.padStart(2, "0")}T${m[4]!.padStart(2, "0")}:${m[5]}:00+05:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Open market table on forex.pk: one row per currency with buying and selling against PKR. */
export function parseForexPkOpenMarket(html: string): PkrQuote[] {
  const marker = html.search(/as per Open Market<\/span>\s*as on/i);
  if (marker < 0) throw new ParseError("forex-pk", "open market section not found");
  const observedAt = parseForexPkTimestamp(htmlToText(html.slice(marker, marker + 400)));
  if (!observedAt) throw new ParseError("forex-pk", "timestamp not found");
  const date = new Date(observedAt.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

  const out: PkrQuote[] = [];
  const section = html.slice(marker);
  for (const tr of section.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (tr.match(/<td[\s\S]*?<\/td>/gi) ?? []).map(htmlToText);
    if (cells.length < 4) continue;
    const code = cells[1]!;
    // Remittance rows (USD-DD, USD-TT) are skipped: cash rates only.
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const buy = Number(cells[2]);
    const sell = Number(cells[3]);
    if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) continue;
    if (out.some((q) => q.currency === code)) continue;
    out.push({ currency: code, date, kind: "open_market", buy, sell, observedAt, source: "forex-pk" });
  }
  if (!out.some((q) => q.currency === "USD")) throw new ParseError("forex-pk", "no USD row");
  return out;
}

export const forexPkProvider: PriceProvider<PkrQuote[]> = {
  id: "forex-pk",
  dataset: "pkr-open-market",
  enabled: () => true,
  async fetch({ fetcher }) {
    const res = await fetcher.get(FOREX_PK_URL, { headers: { Accept: "text/html" } });
    if (!res.ok) throw new ParseError("forex-pk", `HTTP ${res.status}`);
    return parseForexPkOpenMarket(res.body);
  },
};
