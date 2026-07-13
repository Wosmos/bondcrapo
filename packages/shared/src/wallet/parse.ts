import { DENOMINATION_CODES } from "../constants";

/**
 * Parsing of bond lists typed, pasted, scanned or imported from a spreadsheet. Shared by the
 * web wallet and the mobile app so both accept exactly the same input.
 */

/** A single wallet add may expand to at most this many numbers (matches the API contract). */
export const MAX_BONDS_PER_ADD = 5000;

export interface ParsedBondList {
  /** Unique six digit numbers in input order. */
  numbers: string[];
  /** Numbers that appeared more than once (counted once in `numbers`). */
  duplicates: number;
  /** Tokens that looked like bond input but were not valid (for example 5 or 7 digits). */
  invalid: string[];
  /** True when the expansion stopped at `limit`. */
  truncated: boolean;
}

const pad6 = (n: number) => String(n).padStart(6, "0");

/**
 * Accepts free text: six digit numbers separated by anything, and ranges such as
 * `123400-123499`, `123400 to 123499` or `123400..123499`. Other digit runs are reported
 * as invalid so the user can fix them instead of silently losing a bond.
 */
export function parseBondList(text: string, limit: number = MAX_BONDS_PER_ADD): ParsedBondList {
  const seen = new Set<string>();
  const numbers: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  let truncated = false;

  const push = (n: string) => {
    if (seen.has(n)) {
      duplicates++;
      return;
    }
    if (numbers.length >= limit) {
      truncated = true;
      return;
    }
    seen.add(n);
    numbers.push(n);
  };

  const re = /(\d+)(?:\s*(?:-|–|\.\.|to|TO|To|till|se)\s*(\d+))?/g;
  for (const m of text.matchAll(re)) {
    const a = m[1]!;
    const b = m[2];
    if (b !== undefined) {
      if (a.length !== 6 || b.length !== 6) {
        invalid.push(m[0].trim());
        continue;
      }
      const from = Number(a);
      const to = Number(b);
      if (to < from) {
        invalid.push(m[0].trim());
        continue;
      }
      for (let i = from; i <= to; i++) {
        push(pad6(i));
        if (truncated) break;
      }
    } else if (a.length === 6) {
      push(a);
    } else {
      invalid.push(a);
    }
    if (truncated) break;
  }
  return { numbers, duplicates, invalid, truncated };
}

/**
 * Every distinct bond number in OCR, PDF or pasted text: six digit runs, ignoring longer digit runs
 * (dates, phone numbers). People often write numbers in groups ("85 40 56", "854 056"), and OCR
 * keeps those gaps, so digit groups separated only by spaces on one line count as one number when
 * together they are exactly six digits. 000000 is never a bond number.
 */
export function extractBondNumbers(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    for (const m of line.matchAll(/(?<![\d-])\d[\d ]*\d(?![\d-])|(?<![\d-])\d(?![\d-])/g)) {
      const parts = m[0].split(/ +/);
      const whole = parts.filter((p) => p.length === 6);
      if (whole.length > 0) whole.forEach((p) => out.add(p));
      else if (parts.join("").length === 6) out.add(parts.join(""));
    }
  }
  out.delete("000000");
  return [...out];
}

/**
 * Maps what people write ("Rs. 750", "750/-", "40,000 premium", "40000P") to a denomination
 * code. Returns null when it is not one of the known codes.
 */
export function normalizeDenomination(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const premium = /premium|registered|\bp\b|\dp$/i.test(raw.replace(/\s+/g, " "));
  const digits = raw.replace(/rs\.?|pkr|\/-|,|\s/gi, "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  const code = `${Number(digits)}${premium ? "P" : ""}`;
  return (DENOMINATION_CODES as readonly string[]).includes(code) ? code : null;
}

export interface SheetBond {
  denominationCode: string | null;
  bondNumber: string;
  label?: string;
}

export interface ParsedSheet {
  bonds: SheetBond[];
  invalidRows: number;
  duplicates: number;
}

const NUMBER_HEADERS = /^(bond|bonds|bond ?(no|number|numbers|#)s?|numbers?|no\.?|serial|prize ?bonds?)$/i;
const DENOM_HEADERS = /^(denomination|denom|value|amount|rs|type|bond ?value)$/i;
const LABEL_HEADERS = /^(label|note|notes|owner|owner or note|name|comment|holder)$/i;

/** One bond number or a range (`100100-100150`, `100100 to 100150`, `100100..100150`). */
const ENTRY = /(?<!\d)(\d{6})(?:\s*(?:-|–|\.\.|to|TO|To)\s*(\d{6}))?(?!\d)/g;
/** "Owner: Aysha", "Name - Ammad": sets the owner for the lines that follow. */
const OWNER_LINE = /^\s*(?:owner|name|holder|label)\s*[:\-]\s*(.*?)\s*$/i;

/**
 * Collects bonds with their denomination and owner, dropping duplicates and stopping at `limit`.
 * Shared by the spreadsheet and the text readers so both follow the same rules.
 */
class Holdings {
  readonly bonds: SheetBond[] = [];
  readonly invalid: string[] = [];
  duplicates = 0;
  truncated = false;
  private readonly seen = new Set<string>();
  constructor(private readonly limit: number) {}

  /** Adds every number and range found in `text`; returns how many entries it held. */
  addEntries(text: string, denom: string | null, label: string | undefined): number {
    let found = 0;
    for (const m of text.matchAll(ENTRY)) {
      found++;
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      if (b < a) {
        this.invalid.push(m[0]);
        continue;
      }
      for (let n = a; n <= b; n++) this.add(String(n).padStart(6, "0"), denom, label);
    }
    return found;
  }

  add(bondNumber: string, denom: string | null, label: string | undefined): void {
    if (bondNumber === "000000") return;
    const key = `${denom ?? "?"}:${bondNumber}`;
    if (this.seen.has(key)) {
      this.duplicates++;
      return;
    }
    if (this.bonds.length >= this.limit) {
      this.truncated = true;
      return;
    }
    this.seen.add(key);
    this.bonds.push({ denominationCode: denom, bondNumber, ...(label ? { label } : {}) });
  }
}

/**
 * A denomination written on its own ("750", "Rs 1,500", "40000 Premium", "Rs 750 bonds:"). A bond
 * number always has six digits and a denomination never does, so the two cannot be confused.
 */
function headingDenomination(text: string): string | null {
  const t = text.replace(/[:\-–]+\s*$/, "").replace(/\b(prize\s*)?bonds?\b/gi, "").trim();
  if (!t || /\d{6}/.test(t)) return null;
  return normalizeDenomination(t);
}

export interface ParsedHoldings {
  bonds: SheetBond[];
  invalid: string[];
  duplicates: number;
  truncated: boolean;
}

/**
 * Reads a written list of bonds (pasted text, a .txt file, text pulled from a PDF), the way people
 * keep them: a denomination on its own line applies to every number below it until the next one,
 * "Owner: name" does the same for the owner, and a line may hold several numbers and ranges
 * ("280321, 280324, 280353-280354"). "750: 123456, 654321" sets the denomination and lists numbers
 * on one line. Anything after "#" on a line is a comment.
 *
 *   Rs 750
 *   041733, 098148-098149
 *   Owner: Aysha
 *   Rs 1500
 *   160213-160228
 */
export function parseBondHoldings(text: string, limit: number = MAX_BONDS_PER_ADD): ParsedHoldings {
  const out = new Holdings(limit);
  let denom: string | null = null;
  let label: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const owner = OWNER_LINE.exec(line);
    if (owner) {
      label = owner[1] ? owner[1].slice(0, 80) : undefined;
      continue;
    }
    const heading = headingDenomination(line);
    if (heading) {
      denom = heading;
      continue;
    }
    const prefix = /^([^:\d]*\d[\d,]*[^:\d]*?)\s*:\s*(.+)$/.exec(line);
    if (prefix && headingDenomination(prefix[1]!)) {
      denom = headingDenomination(prefix[1]!);
      out.addEntries(prefix[2]!, denom, label);
      continue;
    }
    // No whole six digit number on the line: try digits written in groups ("85 40 56").
    if (out.addEntries(line, denom, label) === 0) for (const n of extractBondNumbers(line)) out.add(n, denom, label);
  }
  return { bonds: out.bonds, invalid: out.invalid, duplicates: out.duplicates, truncated: out.truncated };
}

/**
 * Rows from CSV or XLSX. With a header row (bond number, denomination, owner), a blank denomination
 * or owner cell repeats the one above it, as people fill sheets in Excel; a row holding only a
 * denomination starts a new section; and a bond cell may hold several numbers and ranges
 * ("280321, 280353-280354"). Excel drops leading zeros (55684 for 055684), so short numbers in the
 * bond column are padded back to six digits. Without a header the rows are read like a written
 * list (`parseBondHoldings`).
 */
export function parseSheetRows(rows: readonly (readonly unknown[])[], limit: number = MAX_BONDS_PER_ADD): ParsedSheet {
  const cells = rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
  const header = cells[0];
  if (!header || !header.some((h) => NUMBER_HEADERS.test(h))) return parseHeaderlessRows(cells, limit);
  const numberCol = header.findIndex((h) => NUMBER_HEADERS.test(h));
  const denomCol = header.findIndex((h) => DENOM_HEADERS.test(h));
  const labelCol = header.findIndex((h) => LABEL_HEADERS.test(h));

  const out = new Holdings(limit);
  let invalidRows = 0;
  let denom: string | null = null;
  let label: string | undefined;
  for (const row of cells.slice(1)) {
    if (row.every((c) => c === "")) continue;
    const bondCell = row[numberCol] ?? "";
    const denomCell = denomCol >= 0 ? (row[denomCol] ?? "") : "";
    if (denomCell) denom = normalizeDenomination(denomCell) ?? denom;
    if (labelCol >= 0 && row[labelCol]) label = row[labelCol]!.slice(0, 80);

    if (!bondCell) {
      // A section row: only a denomination (in any cell), no bond.
      const heading = denomCell ? normalizeDenomination(denomCell) : row.map(headingDenomination).find((d) => d !== null) ?? null;
      if (heading) denom = heading;
      else invalidRows++;
      continue;
    }
    // Excel stores 055684 as the number 55684.
    const fixed = /^\d{1,5}$/.test(bondCell) ? bondCell.padStart(6, "0") : bondCell;
    if (out.addEntries(fixed, denom, label) === 0) invalidRows++;
  }
  return { bonds: out.bonds, invalidRows: invalidRows + out.invalid.length, duplicates: out.duplicates };
}

/**
 * Rows without a header: a row holding only a denomination starts a section; a denomination cell
 * next to bond numbers applies to that row only; other rows take the current section's.
 */
function parseHeaderlessRows(cells: string[][], limit: number): ParsedSheet {
  const out = new Holdings(limit);
  let invalidRows = 0;
  let section: string | null = null;
  for (const row of cells) {
    const filled = row.filter(Boolean);
    if (filled.length === 0) continue;
    const bondCells = filled.filter((c) => /\d{6}/.test(c));
    const rowDenom = filled.filter((c) => !/\d{6}/.test(c)).map(headingDenomination).find((d) => d !== null) ?? null;
    if (bondCells.length === 0) {
      if (rowDenom) section = rowDenom;
      else invalidRows++;
      continue;
    }
    if (out.addEntries(bondCells.join(" "), rowDenom ?? section, undefined) === 0) invalidRows++;
  }
  return { bonds: out.bonds, invalidRows: invalidRows + out.invalid.length, duplicates: out.duplicates };
}

/** Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, CRLF). Spreadsheets go through `xlsx`. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const delimiter = detectDelimiter(text);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 1 ? counts[0]![0] : ",";
}
