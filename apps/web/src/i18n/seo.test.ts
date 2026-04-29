import { describe, expect, it } from "vitest";
import { absoluteUrl, alternatesFor, jsonLd, localePath, pageMetadata, siteOrigin } from "./seo";

describe("seo helpers", () => {
  it("resolves the site origin from APP_BASE_URL, then Vercel, then localhost", () => {
    expect(siteOrigin({ APP_BASE_URL: "https://bondcheck.test/" })).toBe("https://bondcheck.test");
    expect(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "bondcheck.vercel.app" })).toBe("https://bondcheck.vercel.app");
    expect(siteOrigin({ APP_BASE_URL: "not a url" })).toBe("http://localhost:3000");
    expect(siteOrigin({})).toBe("http://localhost:3000");
  });

  it("builds locale paths and absolute URLs", () => {
    expect(localePath("ur", "/")).toBe("/ur");
    expect(localePath("en", "prize-bonds/")).toBe("/en/prize-bonds");
    expect(absoluteUrl("en", "/gold-rate", "https://x.test")).toBe("https://x.test/en/gold-rate");
    expect(absoluteUrl(null, "/", "https://x.test")).toBe("https://x.test");
    expect(() => localePath("en", "/a?b=1")).toThrow();
  });

  it("emits canonical plus en, ur and x-default alternates", () => {
    expect(alternatesFor("ur", "/currency/usd-to-pkr", "https://x.test")).toEqual({
      canonical: "https://x.test/ur/currency/usd-to-pkr",
      languages: {
        en: "https://x.test/en/currency/usd-to-pkr",
        ur: "https://x.test/ur/currency/usd-to-pkr",
        "x-default": "https://x.test/currency/usd-to-pkr",
      },
    });
  });

  it("produces page metadata with Open Graph locales and optional noindex", () => {
    const m = pageMetadata({ locale: "ur", path: "/about", title: "T", description: "D", noIndex: true });
    expect(m.openGraph).toMatchObject({ locale: "ur_PK", alternateLocale: ["en_PK"], title: "T" });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(pageMetadata({ locale: "xx", path: "/", title: "T", description: "D" }).openGraph).toMatchObject({ locale: "en_PK" });
  });

  it("escapes JSON-LD so it cannot close the script tag", () => {
    expect(jsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
