import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeQr, qrPath, QrTooLongError } from "./qr";

const hash = (rows: boolean[][]) => createHash("sha256").update(rows.map((r) => r.map((m) => (m ? "1" : "0")).join("")).join("\n")).digest("hex").slice(0, 16);

describe("QR encoder", () => {
  it("picks the smallest version and draws the three finder patterns", () => {
    const qr = encodeQr("https://bondcheck.pk/en/download");
    expect(qr.version).toBe(3);
    expect(qr.size).toBe(29);
    for (const [x0, y0] of [
      [0, 0],
      [qr.size - 7, 0],
      [0, qr.size - 7],
    ]) {
      const ring = [0, 1, 2, 3, 4, 5, 6].map((i) => qr.modules[y0!]![x0! + i]);
      expect(ring.every(Boolean)).toBe(true);
      expect(qr.modules[y0! + 1]![x0! + 1]).toBe(false);
      expect(qr.modules[y0! + 3]![x0! + 3]).toBe(true);
    }
    // the dark module next to the bottom left finder
    expect(qr.modules[qr.size - 8]![8]).toBe(true);
  });

  it("matches matrices cross-checked against an independent encoder", () => {
    // Recorded from this encoder after comparing module by module with the `qrcode` npm package
    // (byte mode, level M, every mask, versions 3, 8 and 10).
    expect(hash(encodeQr("https://bondcheck.pk/en/download").modules)).toBe(RECORDED.short);
    expect(hash(encodeQr("x".repeat(150)).modules)).toBe(RECORDED.v8);
  });

  it("handles UTF-8 and rejects text that does not fit version 10", () => {
    expect(() => encodeQr("بانڈ چیک")).not.toThrow();
    expect(() => encodeQr("y".repeat(300))).toThrow(QrTooLongError);
  });

  it("renders compact SVG path data inside the quiet zone", () => {
    const d = qrPath(encodeQr("HELLO"));
    expect(d.startsWith("M4 4h7v1h-7z")).toBe(true);
  });
});

const RECORDED = { short: "a7c4cd3ea3bcaeef", v8: "9782fa7f0642d3e6" };
