"use client";

/**
 * Reads bond numbers from a photo, PDF or text file on the device; nothing is uploaded.
 * tesseract.js and pdf.js are loaded only when a file is chosen (PLAN section 7).
 * Both libraries load their workers and data from this origin (see `@/lib/vendor-assets`).
 */
import { extractBondNumbers } from "@bondcheck/shared/wallet/parse";
import { recognizeDigits } from "@/lib/ocr-digits";
import { PDF_WORKER_SRC } from "@/lib/vendor-assets";

export { extractBondNumbers };

export async function numbersFromFile(file: File, onProgress: (percent: number) => void): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (file.type === "text/plain" || name.endsWith(".txt") || name.endsWith(".csv")) {
    onProgress(100);
    return extractBondNumbers(await file.text());
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    let text = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
      onProgress(Math.round((p / doc.numPages) * 100));
    }
    await doc.destroy();
    return extractBondNumbers(text);
  }
  return extractBondNumbers(await recognizeDigits(file, onProgress));
}
