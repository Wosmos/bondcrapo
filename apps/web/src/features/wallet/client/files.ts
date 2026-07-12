"use client";

import { extractBondNumbers, parseCsv, parseSheetRows, type ParsedSheet } from "@bondcheck/shared/wallet/parse";
import { PDF_WORKER_SRC } from "@/lib/vendor-assets";
import { recognizeDigits } from "@/lib/ocr-digits";

/**
 * File readers for the bond importer. Every heavy library (xlsx, pdf.js, tesseract) is loaded on
 * demand so none of them reaches the initial bundle (PLAN section 7).
 */

export const SHEET_ACCEPT = ".csv,.txt,.tsv,.xlsx,.xls,text/csv,text/plain";
export const SCAN_ACCEPT = "image/*,application/pdf,.pdf";
/** Large phone photos are fine; anything bigger than this is not a bond list. */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export class FileTooLargeError extends Error {}

export async function readSheetFile(file: File): Promise<{ sheet: ParsedSheet; source: "csv" | "xlsx" }> {
  if (file.size > MAX_FILE_BYTES) throw new FileTooLargeError();
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows: unknown[][] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (ws) rows.push(...XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false }));
    }
    return { sheet: parseSheetRows(rows), source: "xlsx" };
  }
  return { sheet: parseSheetRows(parseCsv(await file.text())), source: "csv" };
}

/** Text from a photo (on-device OCR) or a PDF, then every six digit number in it. */
export async function scanFile(file: File, onProgress: (percent: number) => void): Promise<string[]> {
  if (file.size > MAX_FILE_BYTES) throw new FileTooLargeError();
  let text = "";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
      onProgress(Math.round((i / pdf.numPages) * 100));
    }
  } else {
    text = await recognizeDigits(file, onProgress);
  }
  return extractBondNumbers(text);
}
