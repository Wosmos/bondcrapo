import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy, { config } from "./proxy";

const run = (path: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(new URL(path, "https://bondcheck.test"), { headers }));

const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

describe("proxy locale negotiation", () => {
  it("redirects / to Urdu when the browser prefers Urdu", async () => {
    const res = await run("/", { "accept-language": "ur-PK,ur;q=0.9,en;q=0.5" });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBe("https://bondcheck.test/ur");
  });

  it("defaults to English for other languages", async () => {
    const res = await run("/", { "accept-language": "de-DE,de;q=0.9" });
    expect(res.headers.get("location")).toBe("https://bondcheck.test/en");
  });

  it("lets a saved language choice win over Accept-Language", async () => {
    const res = await run("/", { "accept-language": "ur", cookie: "NEXT_LOCALE=en" });
    expect(res.headers.get("location")).toBe("https://bondcheck.test/en");
  });

  it("keeps deep paths when adding the prefix", async () => {
    const res = await run("/prize-bonds/750", { "accept-language": "ur" });
    expect(res.headers.get("location")).toBe("https://bondcheck.test/ur/prize-bonds/750");
  });

  it("passes prefixed paths through", async () => {
    const res = await run("/ur/about");
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not run for API routes, files and metadata images", () => {
    expect(matches("/api/v1/bonds/latest")).toBe(false);
    expect(matches("/sw.js")).toBe(false);
    expect(matches("/manifest.webmanifest")).toBe(false);
    expect(matches("/sitemap/0.xml")).toBe(false);
    expect(matches("/opengraph-image")).toBe(false);
    expect(matches("/")).toBe(true);
    expect(matches("/ur/prize-bonds")).toBe(true);
  });
});
