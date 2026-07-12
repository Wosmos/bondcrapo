"use client";

import { TESSERACT_PATHS } from "@/lib/vendor-assets";

/**
 * Reads the digits in a photo of bonds, on the device. Tesseract is tuned for print, so the photo
 * is first scaled so its long side is about 2000 px (small crops are too small to read, huge
 * photos are slow), turned to grayscale and contrast-stretched. A hard black and white threshold
 * was tried and read handwriting worse, so it is not used. Recognition treats the page as one
 * block of lines (page segmentation mode 6), which suits a column of numbers, and keeps the spaces
 * people leave between digit groups so they can be joined later. Handwriting stays unreliable:
 * Tesseract is not built for it.
 */
export async function recognizeDigits(file: Blob, onProgress: (percent: number) => void): Promise<string> {
  const image = await prepare(file).catch(() => file);
  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng", undefined, {
    ...TESSERACT_PATHS,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789 ",
      tessedit_pageseg_mode: "6" as never,
      preserve_interword_spaces: "1",
    });
    return (await worker.recognize(image)).data.text;
  } finally {
    await worker.terminate();
  }
}

async function prepare(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(3, 2000 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const img = ctx.getImageData(0, 0, width, height);
  const px = img.data;
  const gray = new Uint8ClampedArray(width * height);
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = Math.round(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
    gray[j] = g;
    histogram[g]!++;
  }
  // Stretch the darkest 1% to black and the brightest 1% to white.
  const [low, high] = percentiles(histogram, gray.length, 0.01, 0.99);
  const span = Math.max(1, high - low);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, Math.round(((gray[j]! - low) * 255) / span)));
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

/** The brightness values below which `lo` and `hi` of all pixels fall. */
export function percentiles(histogram: number[], total: number, lo: number, hi: number): [number, number] {
  let seen = 0;
  let low = 0;
  let high = 255;
  let lowSet = false;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v]!;
    if (!lowSet && seen >= total * lo) {
      low = v;
      lowSet = true;
    }
    if (seen >= total * hi) {
      high = v;
      break;
    }
  }
  return [low, high];
}
