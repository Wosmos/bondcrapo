import { describe, expect, it } from "vitest";
import { pdfLines } from "./pdf-text";
import { parseAppGoldPosts, parseAppGoldStory } from "./providers/app-gold";
import { parseForexPkOpenMarket, parseForexPkTimestamp } from "./providers/forex-pk";
import { parseFreeGoldApi } from "./providers/freegoldapi";
import { parseCurrencyApiDay, parseErApiLatest } from "./providers/fx";
import { parseGoldApiPrice, parseMetalpriceLatest } from "./providers/metals";
import { parseBuySellSheet, parseM2mSheet, parseSbpIndex, parseSheetDate } from "./providers/sbp";
import { fixture, fixtureJson, fixtureText } from "./testing";
import { ParseError } from "./types";

const pdf = (name: string) => pdfLines(new Uint8Array(fixture(`sbp/${name}`)));

describe("gold-api.com", () => {
  it("reads all four metals in USD per ounce", () => {
    const xau = parseGoldApiPrice(fixtureJson("gold-api/price-XAU.json"));
    expect(xau).toMatchObject({ metal: "XAU", priceUsdPerOz: 4170, source: "gold-api" });
    expect(xau.observedAt.toISOString()).toBe("2026-10-15T20:34:46.000Z");
    expect(parseGoldApiPrice(fixtureJson("gold-api/price-XAG.json")).priceUsdPerOz).toBeCloseTo(57.518002, 6);
    expect(parseGoldApiPrice(fixtureJson("gold-api/price-XPT.json")).priceUsdPerOz).toBe(1630);
    expect(parseGoldApiPrice(fixtureJson("gold-api/price-XPD.json")).priceUsdPerOz).toBe(1157);
  });

  it("rejects symbols that are not metals and malformed payloads", () => {
    expect(() => parseGoldApiPrice({ ...(fixtureJson("gold-api/price-XAU.json") as object), symbol: "BTC" })).toThrow(ParseError);
    expect(() => parseGoldApiPrice({ price: "4170" })).toThrow(ParseError);
  });
});

describe("MetalpriceAPI (fallback)", () => {
  it("prefers the USD per ounce field and inverts when only ounces per USD are present", () => {
    const quotes = parseMetalpriceLatest(fixtureJson("metalpriceapi/latest-docs-example.json"));
    expect(quotes.map((q) => q.metal)).toEqual(["XAU", "XAG"]);
    expect(quotes[0]!.priceUsdPerOz).toBeCloseTo(1856.906765, 6);
    const inverted = parseMetalpriceLatest({ success: true, base: "USD", timestamp: 1, rates: { XAU: 0.0005 } });
    expect(inverted[0]!.priceUsdPerOz).toBeCloseTo(2000, 6);
  });

  it("surfaces the API error text", () => {
    expect(() => parseMetalpriceLatest(fixtureJson("metalpriceapi/error-invalid-key.json"))).toThrow(/invalid access key/);
  });
});

describe("reference FX", () => {
  it("ExchangeRate-API: USD base, publication day, ISO currencies only", () => {
    const s = parseErApiLatest(fixtureJson("er-api/latest-USD.json"));
    expect(s.date).toBe("2026-10-15");
    expect(s.rates.USD).toBe(1);
    expect(s.rates.AED).toBe(3.6725);
    expect(s.rates.PKR).toBeGreaterThan(250);
    expect(Object.keys(s.rates).length).toBeGreaterThan(150);
  });

  it("currency-api: drops crypto tokens and turns metals into USD per ounce", () => {
    const d = parseCurrencyApiDay(fixtureJson("currency-api/latest-usd.json"));
    expect(d.date).toBe("2026-10-15");
    expect(d.fx.PKR).toBeCloseTo(277.01907539, 6);
    expect(d.fx).not.toHaveProperty("BTC");
    expect(d.fx).not.toHaveProperty("1INCH");
    expect(d.metals.XAU).toBeCloseTo(1 / 0.0002412717, 4);
    const old = parseCurrencyApiDay(fixtureJson("currency-api/2024-03-06-usd.min.json"));
    expect(old.date).toBe("2024-03-06");
    expect(old.metals.XAU).toBeGreaterThan(1500);
    expect(old.metals.XAU).toBeLessThan(2500);
  });
});

describe("State Bank of Pakistan sheets", () => {
  it("finds the three sheet links on the index", () => {
    const links = parseSbpIndex(fixtureText("sbp/index2-excerpt.html"));
    expect(links.wacer).toMatch(/weighted-average-customer-exchange-rates-15-October-2026\.pdf$/);
    expect(links.m2m).toMatch(/mark-to-market-revaluation-exchange-rate-15-october-2026\.pdf$/);
    expect(links.ecap).toMatch(/open-market-closing-exchange-rates-15-October-2026\.pdf$/);
  });

  it("parses sheet dates in all three styles", () => {
    expect(parseSheetDate("as on15-Oct-26")).toBe("2026-10-15");
    expect(parseSheetDate("15-October-2026")).toBe("2026-10-15");
    expect(parseSheetDate("as on October 5, 2026")).toBe("2026-10-05");
    expect(parseSheetDate("no date here")).toBeNull();
  });

  it("WACER: interbank buying and selling for 10 currencies", async () => {
    const sheet = parseBuySellSheet(await pdf("weighted-average-customer-exchange-rates-15-October-2026.pdf"), "sbp-wacer");
    expect(sheet.date).toBe("2026-10-15");
    expect(sheet.rows).toHaveLength(10);
    expect(sheet.rows.find((r) => r.currency === "USD")).toEqual({ currency: "USD", buy: 276.6081, sell: 277.0649 });
    expect(sheet.rows.find((r) => r.currency === "JPY")).toEqual({ currency: "JPY", buy: 1.7516, sell: 1.7544 });
  });

  it("M2M: the READY column only, skipping unavailable tenors", async () => {
    const sheet = parseM2mSheet(await pdf("mark-to-market-revaluation-exchange-rate-15-october-2026.pdf"));
    expect(sheet.date).toBe("2026-10-15");
    expect(sheet.rows.find((r) => r.currency === "USD")?.ready).toBe(276.9221);
    expect(sheet.rows.find((r) => r.currency === "KWD")?.ready).toBe(898.6602);
    expect(sheet.rows.length).toBeGreaterThanOrEqual(35);
  });

  it("ECAP open market closing rates", async () => {
    const lines = await pdf("open-market-closing-exchange-rates-15-October-2026.pdf");
    const sheet = parseBuySellSheet(lines, "sbp-ecap");
    expect(sheet.date).toBe("2026-10-15");
    expect(sheet.rows.map((r) => r.currency)).toEqual(["USD", "EUR", "GBP", "JPY", "AED", "SAR"]);
    expect(sheet.rows[0]).toEqual({ currency: "USD", buy: 277.51, sell: 278.77 });
  });

  it("rejects a sheet without a dollar row", () => {
    expect(() => parseBuySellSheet(["15-Oct-26", "EUR 1.0 1.1"], "sbp-wacer")).toThrow(/no USD row/);
  });
});

describe("pdf-text", () => {
  it("joins kerned fragments and separates table columns", async () => {
    const lines = await pdf("weighted-average-customer-exchange-rates-15-October-2026.pdf");
    expect(lines).toContain("STATE BANK OF PAKISTAN");
    expect(lines.find((l) => l.startsWith("USD"))).toMatch(/^USD\s{2,}276\.6081\s{2,}277\.0649$/);
  });

  it("returns nothing for bytes that are not a PDF", async () => {
    expect(await pdfLines(new TextEncoder().encode("not a pdf"))).toEqual([]);
  });
});

describe("forex.pk open market", () => {
  it("reads cash rows with the Pakistan time stamp, skipping remittance rows", () => {
    const rows = parseForexPkOpenMarket(fixtureText("forex-pk/open-market-rates.html"));
    expect(rows.find((r) => r.currency === "USD")).toMatchObject({ buy: 277.5, sell: 280.25, kind: "open_market", date: "2026-10-15" });
    expect(rows.some((r) => r.currency.includes("-"))).toBe(false);
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows[0]!.observedAt.toISOString()).toBe("2026-10-15T10:22:00.000Z");
  });

  it("parses the stamp and fails loudly when the section moves", () => {
    expect(parseForexPkTimestamp("as on Thu, Oct 15 2026, 15:22 PST (GMT+5)")?.toISOString()).toBe("2026-10-15T10:22:00.000Z");
    expect(() => parseForexPkOpenMarket("<html><body>maintenance</body></html>")).toThrow(ParseError);
  });
});

describe("APSGJA rates via APP", () => {
  it("takes the newest story and reads final values, not the day's change", () => {
    const batch = parseAppGoldPosts(fixtureJson("app/posts-search-gold-tola.json"));
    expect(batch.date).toBe("2026-10-15");
    const get = (metal: string, karat: number, unit: string) =>
      batch.rates.find((r) => r.metal === metal && r.karat === karat && r.unit === unit)?.price;
    expect(get("XAU", 24, "tola")).toBe(437836);
    expect(get("XAU", 24, "10g")).toBe(375373);
    expect(get("XAU", 22, "10g")).toBe(344104);
    expect(get("XAG", 0, "tola")).toBe(6148);
    expect(get("XAG", 0, "10g")).toBe(5270);
    expect(batch.quotedSpotUsd).toEqual({ XAU: 4153, XAG: 56.7 });
  });

  it("handles a falling day ('fell by Rs3,000 to settle at Rs437,836')", () => {
    const posts = fixtureJson("app/posts-search-gold-tola.json") as { date: string; link: string; title: { rendered: string }; content: { rendered: string } }[];
    const fall = posts.find((p) => p.date.startsWith("2026-10-14"))!;
    const batch = parseAppGoldStory({ date: fall.date, link: fall.link, title: fall.title.rendered, html: fall.content.rendered })!;
    expect(batch.rates.find((r) => r.karat === 24 && r.unit === "tola")?.price).toBe(437836);
    expect(batch.rates.find((r) => r.karat === 22 && r.unit === "10g")?.price).toBe(344104);
  });

  it("ignores stories that are not APSGJA reports", () => {
    expect(parseAppGoldStory({ date: "2026-10-15T10:00:00", link: "https://x.test", title: "Gold", html: "<p>Gold rose by Rs100 per tola</p>" })).toBeNull();
    expect(() => parseAppGoldPosts([])).toThrow(ParseError);
  });
});

describe("FreeGoldAPI", () => {
  it("keeps only World Bank monthly USD rows", () => {
    const points = parseFreeGoldApi(fixtureJson("freegoldapi/latest-excerpt.json"), "2023-01-01");
    expect(points.length).toBeGreaterThan(12);
    expect(points[0]).toEqual({ date: "2023-01-01", priceUsdPerOz: expect.any(Number) });
    expect(points.every((p) => p.date < "2025-01-01")).toBe(true);
  });
});
