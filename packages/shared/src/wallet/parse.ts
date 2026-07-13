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

/** A range written in one cell: `100100-100150`, `100100 to 100150`, `100100..100150`. */
const RANGE_CELL = /^(\d{6})\s*(?:-|–|\.\.|to|TO|To)\s*(\d{6})$/;

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

const NUMBER_HEADERS = /^(bond|bond ?(no|number|#)|number|no\.?|serial|prize ?bond)$/i;
const DENOM_HEADERS = /^(denomination|denom|value|amount|rs|type|bond ?value)$/i;
const LABEL_HEADERS = /^(label|note|notes|owner|name|comment)$/i;

/**
 * Rows from CSV or XLSX (first row may be a header). Without a header, the first cell holding a
 * six digit number is the bond and a cell that normalises to a denomination is the denomination.
 * A bond cell may also hold a range (`100100-100150`), which expands to every number in it, so one
 * file can list a whole series of every denomination at once.
 */
export function parseSheetRows(rows: readonly (readonly unknown[])[], limit: number = MAX_BONDS_PER_ADD): ParsedSheet {
  const cells = rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
  let numberCol = -1;
  let denomCol = -1;
  let labelCol = -1;
  let start = 0;
  const header = cells[0];
  if (header && header.some((h) => NUMBER_HEADERS.test(h))) {
    numberCol = header.findIndex((h) => NUMBER_HEADERS.test(h));
    denomCol = header.findIndex((h) => DENOM_HEADERS.test(h));
    labelCol = header.findIndex((h) => LABEL_HEADERS.test(h));
    start = 1;
  }

  const seen = new Set<string>();
  const bonds: SheetBond[] = [];
  let invalidRows = 0;
  let duplicates = 0;
  for (let r = start; r < cells.length && bonds.length < limit; r++) {
    const row = cells[r]!;
    if (row.every((c) => c === "")) continue;
    let num: string | undefined;
    let denom: string | null = null;
    const rangeCell = (numberCol >= 0 ? [row[numberCol] ?? ""] : row).map((c) => RANGE_CELL.exec(c)).find(Boolean);
    if (rangeCell) {
      const [, a, b] = rangeCell;
      if (Number(b) < Number(a)) {
        invalidRows++;
        continue;
      }
      denom = numberCol >= 0 ? (denomCol >= 0 ? normalizeDenomination(row[denomCol]) : null) : (row.map((c) => (RANGE_CELL.test(c) ? null : normalizeDenomination(c))).find((d) => d !== null) ?? null);
      const label = labelCol >= 0 ? row[labelCol]?.slice(0, 80) : undefined;
      for (let n = Number(a); n <= Number(b) && bonds.length < limit; n++) {
        const bondNumber = String(n).padStart(6, "0");
        const key = `${denom ?? "?"}:${bondNumber}`;
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);
        bonds.push({ denominationCode: denom, bondNumber, ...(label ? { label } : {}) });
      }
      continue;
    }
    if (numberCol >= 0) {
      const v = (row[numberCol] ?? "").replace(/\D/g, "");
      num = v.length > 0 && v.length <= 6 && /^\d+$/.test(row[numberCol] ?? "") ? v.padStart(6, "0") : v;
      if (denomCol >= 0) denom = normalizeDenomination(row[denomCol]);
    } else {
      num = row.find((c) => /^\d{6}$/.test(c));
      denom = row.map((c) => (c === num ? null : normalizeDenomination(c))).find((d) => d !== null) ?? null;
    }
    if (!num || !/^\d{6}$/.test(num)) {
      invalidRows++;
      continue;
    }
    const key = `${denom ?? "?"}:${num}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const label = labelCol >= 0 ? row[labelCol]?.slice(0, 80) : undefined;
    bonds.push({ denominationCode: denom, bondNumber: num, ...(label ? { label } : {}) });
  }
  return { bonds, invalidRows, duplicates };
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
