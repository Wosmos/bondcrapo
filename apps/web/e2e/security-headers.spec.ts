import { expect, test } from "@playwright/test";
import { contentSecurityPolicy } from "../security-headers";
import { mockBoard, showBoard } from "./fixtures";

/** Security headers (PLAN section 11) on the production server (`next start`). */
const ROUTES = ["/en", "/ur/about", "/en/prize-bonds/check", "/en/gold-rate", "/en/my", "/api/v1/health", "/sitemap-index.xml", "/sw.js"];

for (const path of ROUTES) {
  test(`security headers on ${path}`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    const h = res.headers();
    expect(h["content-security-policy"]).toBe(contentSecurityPolicy(false));
    expect(h["strict-transport-security"]).toMatch(/^max-age=63072000; includeSubDomains$/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=(self)");
    expect(h["permissions-policy"]).toContain("geolocation=()");
    expect(h["x-powered-by"]).toBeUndefined();
  });
}

test("the CSP names no third-party host and forbids framing and plugins", () => {
  const csp = contentSecurityPolicy(false);
  expect(csp).not.toMatch(/https?:\/\//);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("'unsafe-eval'");
});

test("pages run without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await mockBoard(page);
  await page.goto("/en");
  await showBoard(page);
  await page.goto("/en/prize-bonds/check");
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});

test("self-hosted scanner assets are served from this origin", async ({ request }) => {
  for (const path of [
    "/vendor/pdfjs/pdf.worker.min.mjs",
    "/vendor/tesseract/worker.min.js",
    "/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js",
    "/vendor/tesseract/lang/eng.traineddata.gz",
  ]) {
    const res = await request.head(path);
    expect(res.status(), path).toBe(200);
  }
});
