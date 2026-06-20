import type { DenominationCode } from "@bondcheck/shared";
import { parseLooseDate } from "./dates";
import { findCity } from "./parse-result-text";
import { denominationForLegacyId } from "./sources";

export const HTML_PARSER_VERSION = "html@1";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------------------------
// Official denomination page: links to TXT/PDF uploads labelled with the draw date.

export interface OfficialFileLink {
  url: string;
  format: "txt" | "pdf" | "doc";
  /** Draw date from the link label (`15-01-2026 (Text)`), or from the file name as a fallback. */
  drawDate: string | null;
  label: string;
}

export function parseOfficialListing(html: string): OfficialFileLink[] {
  const out: OfficialFileLink[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+\.(txt|pdf|docx?))"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = decodeEntities(m[1]!);
    if (!/\/wp-content\/uploads\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    const label = stripTags(m[3]!);
    const ext = m[2]!.toLowerCase();
    const file = url.split("/").pop() ?? "";
    let drawDate: string | null = null;
    const fromLabel = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(label);
    if (fromLabel) drawDate = parseLooseDate(fromLabel[0]);
    if (!drawDate) {
      // e.g. "100_170826.txt" (DDMMYY) or "15-05-2023-Rs-100.txt"
      const compact = /_(\d{2})(\d{2})(\d{2})(?:[-_.]|$)/.exec(file);
      const dashed = /(\d{1,2})-(\d{1,2})-(\d{4})/.exec(file);
      if (compact) drawDate = parseLooseDate(`${compact[1]}-${compact[2]}-20${compact[3]}`);
      else if (dashed) drawDate = parseLooseDate(dashed[0]);
    }
    out.push({ url, format: ext === "txt" ? "txt" : ext === "pdf" ? "pdf" : "doc", drawDate, label });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Official legacy search: draw date list (`ajaxData.php`, one POST per denomination).

export interface OfficialDateEntry {
  stateId: number;
  drawDate: string;
}

export function parseOfficialDateList(html: string): OfficialDateEntry[] {
  const out: OfficialDateEntry[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<option\s+value="(\d+)"\s*>([^<]+)<\/option>/gi)) {
    const drawDate = parseLooseDate(decodeEntities(m[2]!).trim());
    if (!drawDate || seen.has(drawDate)) continue;
    seen.add(drawDate);
    out.push({ stateId: Number(m[1]), drawDate });
  }
  return out.sort((a, b) => a.drawDate.localeCompare(b.drawDate));
}

export function denominationForDateListUrl(url: string): DenominationCode | null {
  const m = /#id=(\d+)$/.exec(url);
  return m ? denominationForLegacyId(Number(m[1])) : null;
}

// ---------------------------------------------------------------------------------------------
// Official legacy search: single number spot check (`results.php`).

export interface SpotResult {
  number: string;
  won: boolean;
  tier: 1 | 2 | 3 | null;
  amountPkr: number | null;
  city: string | null;
  drawNumber: number | null;
  drawDate: string | null;
}

const TIER_WORDS: Record<string, 1 | 2 | 3> = { first: 1, second: 2, third: 3 };

/** Parses the answer for one searched number. "OOPS! Try again later draws!!" means no prize. */
export function parseOfficialSpot(html: string, searched: string): SpotResult {
  const text = stripTags(html.replace(/<script[\s\S]*?<\/script>/gi, " "));
  const m = new RegExp(
    `(First|Second|Third)\\s+(${searched})\\s+([\\d,]+)\\s+([A-Za-z .]+?)\\s+(\\d{1,3})\\s+(\\d{1,2}\\s+[A-Za-z]+,?\\s+\\d{4})`,
    "i",
  ).exec(text);
  if (!m || !/YOU WON/i.test(text)) {
    return { number: searched, won: false, tier: null, amountPkr: null, city: null, drawNumber: null, drawDate: null };
  }
  return {
    number: searched,
    won: true,
    tier: TIER_WORDS[m[1]!.toLowerCase()] ?? null,
    amountPkr: Number(m[3]!.replace(/,/g, "")),
    city: findCity(m[4]!),
    drawNumber: Number(m[5]),
    drawDate: parseLooseDate(m[6]!),
  };
}

export function parseSpotUrl(url: string): { stateId: number; drawDate: string; number: string; legacyId: number } | null {
  const m = /#country=(\d+)&state=(\d+)&date=(\d{4}-\d{2}-\d{2})&number=(\d{6})$/.exec(url);
  return m ? { legacyId: Number(m[1]), stateId: Number(m[2]), drawDate: m[3]!, number: m[4]! } : null;
}

// ---------------------------------------------------------------------------------------------
// prizeinfo.net first and second prize records (one page per denomination, back to 2000).

export interface PrizeinfoRecordRow {
  drawNumber: number | null;
  tier1: number[];
  tier2: number[];
  city: string | null;
  drawDate: string;
}

export function parsePrizeinfoRecord(html: string): PrizeinfoRecordRow[] {
  const out: PrizeinfoRecordRow[] = [];
  for (const row of html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((c) => ({
      cls: c[1] ?? "",
      text: stripTags(c[2]!),
    }));
    if (cells.length < 4) continue;
    const dateCell = cells.find((c) => /^\d{2}-\d{2}-\d{4}$/.test(c.text));
    const drawDate = dateCell ? parseLooseDate(dateCell.text) : null;
    if (!drawDate) continue;
    // A cell may hold several numbers separated by <br> (Premium 25000 has two first prizes).
    const nums = (cls: RegExp) =>
      cells.filter((c) => cls.test(c.cls)).flatMap((c) => c.text.split(/\s+/).filter((t) => /^\d{6}$/.test(t)).map(Number));
    const tier1 = nums(/table-success/);
    const tier2 = nums(/table-warning/);
    const first = cells[0]!.text;
    const cityCell = cells[cells.indexOf(dateCell!) - 1];
    out.push({
      drawNumber: /^\d{1,3}$/.test(first) ? Number(first) : null,
      tier1,
      tier2,
      city: cityCell ? findCity(cityCell.text) : null,
      drawDate,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// prizeinfo.net yearly schedule: denomination, draw number, date and city of every draw.

export interface ScheduleRow {
  denominationCode: DenominationCode;
  drawNumber: number | null;
  drawDate: string;
  city: string | null;
}

export function parsePrizeinfoSchedule(html: string): ScheduleRow[] {
  const out: ScheduleRow[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]!));
    if (cells.length < 3) continue;
    const denom = /Rs\.?\s*(\d+)\s*(Premium)?/i.exec(cells[1] ?? "");
    const number = /Draw No\.?\s*(\d+)/i.exec(cells[1] ?? "");
    const when = /(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*\(([^)]+)\)/.exec(cells[2] ?? "");
    if (!denom || !when) continue;
    const code = `${denom[1]}${denom[2] ? "P" : ""}` as DenominationCode;
    const drawDate = parseLooseDate(when[1]!);
    if (!drawDate) continue;
    out.push({
      denominationCode: code,
      drawNumber: number ? Number(number[1]) : null,
      drawDate,
      city: findCity(when[2]!),
    });
  }
  return out;
}
