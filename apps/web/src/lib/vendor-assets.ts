/**
 * Self-hosted assets for on-device scanning (copied by scripts/vendor-assets.mjs). Serving them
 * from this origin keeps the Content-Security-Policy free of third-party hosts (PLAN section 11).
 */
export const PDF_WORKER_SRC = "/vendor/pdfjs/pdf.worker.min.mjs";

export const TESSERACT_PATHS = {
  workerPath: "/vendor/tesseract/worker.min.js",
  corePath: "/vendor/tesseract/core",
  langPath: "/vendor/tesseract/lang",
} as const;
