/** Marker on the first line of `source_documents.body` for PDFs (the body holds extracted text). */
export const PDF_TEXT_MARKER = "%bondcheck:pdf-text";
/** Marker for PDFs without a text layer (scans). They need OCR and are never parsed as results. */
export const PDF_NO_TEXT_MARKER = "%bondcheck:pdf-no-text";

export interface PdfText {
  pages: number;
  /** Lines in reading order (top to bottom, start to end), pages separated by a blank line. */
  text: string;
  hasTextLayer: boolean;
}

interface TextItem {
  str: string;
  transform: number[];
}

/**
 * Extracts text from a PDF with pdf.js (legacy Node build, loaded lazily so the module never
 * lands in a client or edge bundle). Items are grouped into lines by their baseline and sorted
 * by x, which reproduces the column layout of the official result sheets. Scanned PDFs (camera
 * or copier output) have no text layer and are reported as such.
 */
export async function extractPdfText(data: Uint8Array): Promise<PdfText> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  try {
    const out: string[] = [];
    let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; s: string }[]>();
      for (const raw of content.items) {
        const item = raw as Partial<TextItem>;
        if (typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
        const y = Math.round(item.transform[5] ?? 0);
        // Merge baselines that differ by a point or two (superscripts, scanned text).
        const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
        const row = rows.get(key) ?? [];
        row.push({ x: item.transform[4] ?? 0, s: item.str });
        rows.set(key, row);
        chars += item.str.trim().length;
      }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) {
        out.push(
          rows
            .get(y)!
            .sort((a, b) => a.x - b.x)
            .map((i) => i.s)
            .join(" ")
            .replace(/\s+$/, ""),
        );
      }
      out.push("");
      page.cleanup();
    }
    return { pages: doc.numPages, text: out.join("\n"), hasTextLayer: chars >= 200 };
  } finally {
    await doc.destroy();
  }
}

/** Body stored in `source_documents` for a PDF: a marker line, then the extracted text. */
export function pdfBody(extracted: PdfText): string {
  return extracted.hasTextLayer
    ? `${PDF_TEXT_MARKER} pages=${extracted.pages}\n${extracted.text}`
    : `${PDF_NO_TEXT_MARKER} pages=${extracted.pages}\n`;
}

export function isPdfBody(body: string): boolean {
  return body.startsWith(PDF_TEXT_MARKER) || body.startsWith(PDF_NO_TEXT_MARKER);
}

export function pdfBodyText(body: string): string | null {
  if (!body.startsWith(PDF_TEXT_MARKER)) return null;
  return body.slice(body.indexOf("\n") + 1);
}
