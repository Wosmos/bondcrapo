import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * WCAG 2.2 AA contrast for the design tokens, read straight from globals.css so the stylesheet
 * stays the single source of truth. Text pairs need 4.5:1; UI boundaries and focus rings 3:1.
 */
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB mix, used to approximate the tinted badge backgrounds (`color-mix` 14% tone). */
function mix(fg: string, bg: string, amount: number): string {
  const ch = (h: string, i: number) => Number.parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) => Math.round(ch(fg, i) * amount + ch(bg, i) * (1 - amount)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

const TEXT_ON = ["paper", "surface", "surface-2"] as const;
const TEXT = ["ink", "ink-2", "brand", "brand-strong", "gold-ink", "success", "warning", "danger", "info"] as const;

describe.each([
  ["light", ":root"],
  ["dark", ':root[data-theme="dark"]'],
])("%s theme tokens", (_name, selector) => {
  const t = block(selector);

  it("defines every token", () => {
    for (const key of [...TEXT_ON, ...TEXT, "line-strong", "on-brand", "focus", "gold"]) {
      expect(t[key], key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(TEXT.flatMap((fg) => TEXT_ON.map((bg) => [fg, bg] as const)))("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("button text on brand fills is at least 4.5:1", () => {
    expect(contrast(t["on-brand"], t.brand)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["on-brand"], t["brand-strong"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.paper, t.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it("borders of controls and focus rings are at least 3:1", () => {
    for (const bg of TEXT_ON) {
      expect(contrast(t["line-strong"], t[bg])).toBeGreaterThanOrEqual(3);
      expect(contrast(t.focus, t[bg])).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(["success", "warning", "danger", "info", "gold-ink"] as const)("badge text %s stays readable on its tint", (tone) => {
    expect(contrast(t[tone], mix(t[tone], t.surface, 0.14))).toBeGreaterThanOrEqual(4.5);
  });
});

it("the dark media query and the explicit dark theme agree", () => {
  const media = css.indexOf(':root:not([data-theme="light"]) {');
  const body = css.slice(media, css.indexOf("}", media));
  const fromMedia = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
  expect(fromMedia).toEqual(block(':root[data-theme="dark"]'));
});
