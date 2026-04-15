import { findDate, parseLooseDate } from "./dates";
import type { ParsedResultDocument, Tier, TierHeader } from "./types";

/** Bumped whenever parsing output can change, so `draw_sources.parser_version` shows what produced a list. */
export const RESULT_PARSER_VERSION = "official-text@1";

/** Cities where National Savings holds draws (SBP Banking Services Corporation offices). */
export const DRAW_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Peshawar",
  "Quetta",
  "Multan",
  "Faisalabad",
  "Hyderabad",
  "Muzaffarabad",
  "Sialkot",
  "Bahawalpur",
  "Gujranwala",
  "Sukkur",
  "D.I. Khan",
] as const;

const FACE_VALUES = new Set([100, 200, 750, 1500, 7500, 15000, 25000, 40000]);

/** Finds a known draw city in free text and returns its canonical spelling. */
export function findCity(text: string): string | null {
  const lower = text.toLowerCase();
  let best: { city: string; at: number } | null = null;
  for (const city of DRAW_CITIES) {
    const needle = city === "D.I. Khan" ? /d\.?\s?i\.?\s?khan/ : new RegExp(`\\b${city.toLowerCase()}\\b`);
    const m = needle.exec(lower);
    if (m && (best === null || m.index < best.at)) best = { city, at: m.index };
  }
  return best?.city ?? null;
}

/** Line endings, tabs, non breaking spaces, dashes and quotes in one canonical form. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

// A tier header is "First Prize of ...", "1st Prize: ...", "First Prize of Rs ..." and so on. The
// trailing guard keeps preamble prose ("will get the first prize in each series") out.
const TIER1 = /(?:^|[^a-z])(?:first|1st)\s+prize\s*(?:of\b|:|rs\b|\(|$)/i;
const TIER2 = /(?:^|[^a-z])(?:second|2nd)\s+prize\s*(?:of\b|:|rs\b|\(|$)/i;
const TIER3 = [
  /(?:^|[^a-z])(?:third|3rd)\s+p+rize/i,
  /\d[\d,]*\s*prizes?(?:\s*\(s\))?\s*of/i,
  // "PART-II", also run together with OCR noise ("IPART -II")
  /part\s*-?\s*(?:ii|2)\b/i,
];

const AMOUNT_RS = /rs\.?\s*(?:rs\.?\s*)?(\d{1,3}(?:,\s?\d{3})+|\d+)(?:\s*\/-)?/gi;
const AMOUNT_SLASH = /\b\d[\d,]*\s*\/-/g;
const BOND_TOKEN = /(?<![0-9A-Za-z])\d{6}(?![0-9A-Za-z])/g;
/** "drawn from amongst numbers 000001 to 999999" states the range, it is not a result. */
const RANGE_SENTENCE = /amongst|\b0{5}1\s+to\s+9{6}\b/i;

function digits(value: string): number {
  return Number(value.replace(/[^\d]/g, ""));
}

/** "Rs. 200/- denomination" names the bond, not a prize amount. */
const DENOMINATION_PHRASE = /rs\.?\s*[\d,]+\s*\/?-?\s*(?:\/-)?\s*(?:denomination|prize\s+bonds?|premium|national|student)/gi;

function amountFrom(sectionText: string): number | null {
  const text = sectionText.replace(/\s+/g, " ").replace(DENOMINATION_PHRASE, " ");
  AMOUNT_RS.lastIndex = 0;
  const rs = AMOUNT_RS.exec(text);
  const raw = rs?.[1] ?? /\bof\s+(\d{1,3}(?:,\s?\d{3})+|\d+)\s*\/-/i.exec(text)?.[1];
  if (!raw) return null;
  const n = digits(raw);
  return n >= 100 && n <= 1_000_000_000 ? n : null;
}

function countFrom(text: string): number | null {
  const m =
    /(\d[\d,]*)\s*prizes?(?:\s*\(s\))?\s+of\b/i.exec(text) ??
    /(?:^|[^\w,])(\d{1,2})\s+prizes?\b(?!\s+in\s+each)/i.exec(text);
  if (!m) return null;
  const n = digits(m[1]!);
  return n > 0 && n < 100_000 ? n : null;
}

/** Removes prize amounts so that `Rs.300000` is never mistaken for a bond number. */
function stripAmounts(line: string): string {
  return line.replace(AMOUNT_RS, " ").replace(AMOUNT_SLASH, " ");
}

function bondTokens(line: string): number[] {
  if (RANGE_SENTENCE.test(line)) return [];
  const out: number[] = [];
  for (const m of stripAmounts(line).matchAll(BOND_TOKEN)) {
    const n = Number(m[0]);
    // 000000 is spreadsheet padding in some official files; real numbers run 000001 to 999999.
    if (n > 0) out.push(n);
  }
  return out;
}

function headerFields(text: string, lines: string[]): ParsedResultDocument["header"] {
  const flat = text.replace(/\s+/g, " ");

  let drawNumber: number | null = null;
  for (const re of [/draw\s*no\.?\s*:?\s*(\d{1,3})\s*(?:st|nd|rd|th)?\b/i, /\b(\d{1,3})\s*(?:st|nd|rd|th)\s+draw\b/i]) {
    const m = re.exec(flat);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 500) {
        drawNumber = n;
        break;
      }
    }
  }

  let drawDate: string | null = null;
  const datePatterns = [
    /\bdate\s*:\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
    /\bheld\s+on\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
    /\bheld\s+at\s+[a-z .]{3,30}?\s+on\s+(\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9}\.?,?\s+\d{4})/i,
    /\bheld\s+today\s+(?:on\s+|the\s+)*(\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9},?\s+\d{4})/i,
    /\bheld\s+today\s+(?:on\s+|the\s+)*([a-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const re of datePatterns) {
    const m = re.exec(flat);
    const iso = m ? (parseLooseDate(m[1]!) ?? findDate(m[1]!)) : null;
    if (iso) {
      drawDate = iso;
      break;
    }
  }

  const venueLines = lines.filter((l) => /held|sbp\s*bsc|banking\s+services/i.test(l));
  const city = findCity(venueLines.join(" \n "));

  let faceValue: number | null = null;
  const fm = /rs\.?\s*([\d,]{3,6})\s*\/?-?\s*(?:\/-)?\s*(?:prize|denomination|premium|national|student)/i.exec(flat);
  if (fm) {
    const n = digits(fm[1]!);
    if (FACE_VALUES.has(n)) faceValue = n;
  }
  const premium = /premium/i.test(flat) && (faceValue === 25000 || faceValue === 40000);
  return { faceValue, premium, drawNumber, drawDate, city };
}

/**
 * Parses an official National Savings result document (the TXT upload, or text extracted from
 * a PDF). Tier sections are located by their headers ("First Prize of Rs ...", "1st Prize:",
 * "(1199 Prizes of Rs.1,000/- each)", "PART-II") and must appear in order; only six digit tokens
 * inside a section count, after prize amounts are removed. Numbers in the preamble (the range
 * sentence, notification numbers, series counts) are never collected.
 */
export function parseResultText(raw: string): ParsedResultDocument {
  const text = normalizeText(raw);
  const lines = text.split("\n");
  const sections: Record<Tier, { text: string[]; numbers: number[] }> = {
    1: { text: [], numbers: [] },
    2: { text: [], numbers: [] },
    3: { text: [], numbers: [] },
  };
  const preamble: string[] = [];
  let state: 0 | Tier = 0;

  for (const line of lines) {
    if (TIER1.test(line) && state === 0) state = 1;
    else if (TIER2.test(line) && (state === 1 || state === 0)) state = 2;
    else if (state === 2 && TIER3.some((re) => re.test(line))) state = 3;

    if (state === 0) {
      preamble.push(line);
      continue;
    }
    const section = sections[state];
    const tokens = bondTokens(line);
    section.numbers.push(...tokens);
    section.text.push(line.replace(BOND_TOKEN, " "));
  }

  const warnings: string[] = [];
  const seriesCounts = [...preamble.join("\n").matchAll(/(\d[\d,]*)\s+prizes?\s+in\s+each\s+series/gi)].map((m) =>
    digits(m[1]!),
  );

  const tiers = {} as ParsedResultDocument["tiers"];
  for (const tier of [1, 2, 3] as const) {
    const sectionText = sections[tier].text.join("\n").replace(/[ ]{2,}/g, " ");
    const header: TierHeader = {
      amountPkr: amountFrom(sectionText),
      count: countFrom(sectionText) ?? (seriesCounts.length >= 3 ? (seriesCounts[tier - 1] ?? null) : null),
    };
    tiers[tier] = { header, numbers: sections[tier].numbers };
  }

  // Some official files print the total of all tiers in the third prize heading
  // ("2400 Prizes of Rs.1250/- Each" for 1 + 5 + 2394). Read it as the total only when the
  // parsed lists add up to it exactly; otherwise the mismatch is left for validation to reject.
  const n1 = tiers[1].numbers.length;
  const n2 = tiers[2].numbers.length;
  const n3 = tiers[3].numbers.length;
  const c3 = tiers[3].header.count;
  if (c3 !== null && c3 !== n3 && c3 === n1 + n2 + n3) {
    tiers[3].header.count = n3;
    warnings.push(`third prize heading states ${c3}, the total of all tiers; read as ${n3} third prizes`);
  }
  if (state === 0) warnings.push("no prize section headers found");

  return { header: headerFields(text, lines), tiers, warnings };
}
