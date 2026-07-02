import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { fxDaily, fxPkrMarket, ingestionIssues, ingestionRuns, localRates, metalDaily, metalSpot, rateLimits } from "@bondcheck/db";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import { localRatesFor } from "@bondcheck/db/queries/markets";
import { runJob, runJobToCompletion } from "../run-job";
import { marketsBackfillJob } from "./backfill";
import { fxDailyJob, housekeepingJob, localRatesDeriveJob, metalsSpotJob, pkMarketJob } from "./jobs";
import { fixtureFetcher, fixtureJson } from "./testing";

// 19:00 in Karachi on 2026-10-15: after the APP story (17:06 PKT) and the forex.pk update (15:22 PKT).
const NOW = new Date("2026-10-15T14:00:00Z");
const now = () => NOW;
const ENV = { METALS_FALLBACK_API_KEY: "test-key-not-real" };

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});

const run = (job: Parameters<typeof runJob>[0], overrides: Parameters<typeof fixtureFetcher>[0] = {}) => {
  const { fetcher, calls } = fixtureFetcher(overrides);
  return runJob(job, { db: t.db, fetcher, trigger: "manual", now }).then((r) => ({ ...r, calls }));
};
const fail500 = () => new Response("upstream down", { status: 500 });

async function issues() {
  return t.db.select().from(ingestionIssues);
}

describe("metals-spot", () => {
  it("stores one tick per metal, rolls the daily candle and is idempotent", async () => {
    const first = await run(metalsSpotJob(ENV));
    expect(first.stats).toMatchObject({ provider: "gold-api", fallbackUsed: false, quotes: 4, ticksInserted: 4 });
    const second = await run(metalsSpotJob(ENV));
    expect(second.stats).toMatchObject({ ticksInserted: 0 });
    expect(await t.db.select().from(metalSpot)).toHaveLength(4);
    const [gold] = await t.db.select().from(metalDaily).where(eq(metalDaily.metal, "XAU"));
    expect(gold).toMatchObject({ date: "2026-10-15", closeUsd: "4170.00000000", source: "gold-api" });
  });

  it("falls back to the key based provider when gold-api fails, and reports a partial run", async () => {
    const r = await run(metalsSpotJob(ENV), { "https://api.gold-api.com/price/XAU": fail500 });
    expect(r.status).toBe("partial");
    expect(r.stats).toMatchObject({ provider: "metalpriceapi", fallbackUsed: true });
    const ticks = await t.db.select().from(metalSpot);
    expect(ticks.every((x) => x.source === "metalpriceapi")).toBe(true);
    const warn = (await issues()).find((i) => i.entity === "metal-spot" && i.entityKey === "gold-api");
    expect(warn?.severity).toBe("warn");
    expect(warn?.message).toMatch(/500/);
    // The key travels in a header, never in the URL.
    expect(r.calls.find((c) => c.url.includes("metalpriceapi"))?.headers["X-API-KEY"]).toBe("test-key-not-real");
    expect(r.calls.every((c) => !c.url.includes("test-key-not-real"))).toBe(true);
  });

  it("fails the run when every provider fails, without writing prices", async () => {
    const r = await run(metalsSpotJob({}), { "https://api.gold-api.com/price/XAU": fail500 });
    expect(r.status).toBe("failed");
    expect(await t.db.select().from(metalSpot)).toHaveLength(0);
    const [row] = await t.db.select().from(ingestionRuns);
    expect(row?.error).toMatch(/every provider failed/);
  });

  it("holds back a price that jumped more than 15% and records an error issue", async () => {
    await t.db.insert(metalSpot).values({ metal: "XPT", priceUsdPerOz: "1000", observedAt: new Date("2026-10-15T08:00:00Z"), source: "gold-api" });
    const r = await run(metalsSpotJob(ENV));
    expect(r.status).toBe("partial");
    expect(r.stats).toMatchObject({ rejected: 1, quotes: 3 });
    expect((await issues()).some((i) => i.severity === "error" && i.entityKey === "XPT:gold-api")).toBe(true);
  });
});

describe("fx-daily", () => {
  it("stores reference rates and SBP interbank buying and selling", async () => {
    const r = await run(fxDailyJob(ENV));
    expect(r.status).toBe("partial"); // no spot yet, so local rates cannot be derived
    expect(r.stats).toMatchObject({ reference: { provider: "er-api", date: "2026-10-15" }, interbank: { provider: "sbp-wacer", date: "2026-10-15", rows: 10 } });
    const [pkr] = await t.db.select().from(fxDaily).where(eq(fxDaily.quote, "PKR"));
    expect(pkr?.source).toBe("er-api");
    const [usd] = await t.db.select().from(fxPkrMarket).where(and(eq(fxPkrMarket.currency, "USD"), eq(fxPkrMarket.kind, "interbank")));
    expect(usd).toMatchObject({ buy: "276.608100", sell: "277.064900", source: "sbp-wacer" });
  });

  it("uses the M2M sheet when WACER is unavailable, then the reference rate as a last resort", async () => {
    const wacer = "https://www.sbp.org.pk/assets/document/weighted-average-customer-exchange-rates-15-October-2026.pdf";
    const m2m = "https://www.sbp.org.pk/assets/document/mark-to-market-revaluation-exchange-rate-15-october-2026.pdf";
    const a = await run(fxDailyJob(ENV), { [wacer]: fail500 });
    expect(a.stats).toMatchObject({ interbank: { provider: "sbp-m2m" } });
    const [usd] = await t.db.select().from(fxPkrMarket).where(eq(fxPkrMarket.currency, "USD"));
    expect(usd).toMatchObject({ buy: "276.922100", sell: "276.922100" });

    t = await createTestDb();
    const b = await run(fxDailyJob(ENV), { [wacer]: fail500, [m2m]: fail500 });
    expect(b.stats).toMatchObject({ interbank: { provider: "er-api", rows: 1 } });
  });

  it("falls back to currency-api when ExchangeRate-API fails", async () => {
    const r = await run(fxDailyJob(ENV), { "https://open.er-api.com/v6/latest/USD": fail500 });
    expect(r.status).toBe("partial");
    expect(r.stats).toMatchObject({ reference: { provider: "currency-api" } });
  });
});

describe("pk-market and derivation", () => {
  async function seedSpotAndFx() {
    await run(metalsSpotJob(ENV));
    await run(fxDailyJob(ENV));
  }

  it("stores open market rates and the APSGJA report, then fills the other karats", async () => {
    await seedSpotAndFx();
    const r = await run(pkMarketJob(ENV));
    expect(r.status).toBe("ok");
    expect(r.stats).toMatchObject({ openMarket: { provider: "forex-pk" }, gold: { stored: 5, rejected: 0, reportDate: "2026-10-15" } });
    const pk = await localRatesFor(t.db, "PK", null);
    const pick = (karat: number, unit: string, kind: string, metal = "XAU") =>
      pk.find((x) => x.metal === metal && x.karat === karat && x.unit === unit && x.kind === kind);
    expect(pick(24, "tola", "reported")).toMatchObject({ price: 437836, source: "app-apsgja", date: "2026-10-15", sourceUrl: "https://www.app.com.pk/business/gold-prices-remain-unchanged-at-rs437836-per-tola/" });
    // purity fills are our calculation: they carry no report link of their own
    expect(pick(21, "tola", "derived")!.sourceUrl).toBeNull();
    expect(pick(21, "tola", "derived")).toMatchObject({ source: "apsgja-purity" });
    expect(pick(21, "tola", "derived")!.price).toBeCloseTo((437836 * 21) / 24, 2);
    // the bare international parity next to the reported 24K tola: within 0.1% that day
    const parity = pick(24, "tola", "derived")!;
    expect(parity.source).toBe("derived");
    expect(Math.abs(parity.price / 437836 - 1)).toBeLessThan(0.001);
  });

  it("rejects a reported value more than 5% from the derived value", async () => {
    await seedSpotAndFx();
    const posts = fixtureJson("app/posts-search-gold-tola.json") as { content: { rendered: string } }[];
    const tampered = structuredClone(posts);
    tampered[0]!.content.rendered = tampered[0]!.content.rendered.replace("Rs437,836", "Rs487,836");
    const url = "https://www.app.com.pk/wp-json/wp/v2/posts?search=gold%20tola&per_page=10&_fields=id,date,link,title,content";
    const r = await run(pkMarketJob(ENV), { [url]: () => Response.json(tampered) });
    expect(r.stats).toMatchObject({ gold: { stored: 4, rejected: 1 } });
    const bad = (await issues()).find((i) => i.entity === "pk-gold-reported" && i.severity === "error");
    expect(bad?.message).toMatch(/11\.4% from the derived value; rejected/);
    const reported = await t.db.select().from(localRates).where(and(eq(localRates.kind, "reported"), eq(localRates.unit, "tola"), eq(localRates.metal, "XAU")));
    expect(reported).toHaveLength(0);
  });

  it("uses the SBP ECAP sheet when forex.pk is down", async () => {
    await seedSpotAndFx();
    const r = await run(pkMarketJob(ENV), { "https://www.forex.pk/open_market_rates.asp": fail500 });
    expect(r.status).toBe("partial");
    expect(r.stats).toMatchObject({ openMarket: { provider: "sbp-ecap" } });
  });

  it("derives estimates for all ten countries", async () => {
    await seedSpotAndFx();
    const r = await run(localRatesDeriveJob);
    expect(r.status).toBe("ok");
    expect(r.stats.countries).toEqual(["PK", "AE", "SA", "QA", "KW", "OM", "BH", "GB", "US", "IN"]);
    const ae = await localRatesFor(t.db, "AE", null);
    const g24 = ae.find((x) => x.metal === "XAU" && x.karat === 24 && x.unit === "g")!;
    expect(g24).toMatchObject({ kind: "derived", currency: "AED", source: "derived" });
    expect(g24.price).toBeCloseTo((4170 / 31.1034768) * 3.6725 * 0.999, 2);
  });
});

describe("housekeeping", () => {
  it("prunes ticks older than 30 days and rate limit windows older than a day", async () => {
    await t.db.insert(metalSpot).values([
      { metal: "XAU", priceUsdPerOz: "4000", observedAt: new Date("2026-09-01T00:00:00Z"), source: "gold-api" },
      { metal: "XAU", priceUsdPerOz: "4170", observedAt: new Date("2026-10-15T09:00:00Z"), source: "gold-api" },
    ]);
    await t.db.insert(rateLimits).values([
      { key: "markets:a", windowStart: new Date("2026-10-13T00:00:00Z"), count: 3 },
      { key: "markets:b", windowStart: new Date("2026-10-15T13:59:00Z"), count: 1 },
    ]);
    const r = await run(housekeepingJob);
    expect(r.stats).toMatchObject({ ticksPruned: 1, rateLimitRowsPruned: 1 });
    expect(await t.db.select().from(metalSpot)).toHaveLength(1);
  });
});

describe("history backfill", () => {
  it("loads daily FX and metal closes, resumes from its cursor and never overwrites", async () => {
    let calls = 0;
    const { fetcher } = fixtureFetcher();
    const job = marketsBackfillJob({ from: "2026-10-01", to: "2026-10-05" });
    // budget of zero: every chunk handles one day, then stops
    const results = await runJobToCompletion(job, { db: t.db, fetcher, trigger: "cli", now: () => new Date(NOW.getTime() + calls++ * 1000), budgetMs: 0 });
    expect(results.at(-1)?.status).toBe("ok");
    expect(results.length).toBeGreaterThan(1);
    const days = await t.db.select().from(metalDaily).where(eq(metalDaily.metal, "XAU"));
    expect(days.map((d) => d.date).sort()).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(days.every((d) => d.source === "currency-api")).toBe(true);
    const pkr = await t.db.select().from(fxDaily).where(eq(fxDaily.quote, "PKR"));
    expect(pkr).toHaveLength(5);

    // a day we hold from our own ticks is not replaced
    await t.db.update(metalDaily).set({ closeUsd: "1.00000000", source: "gold-api" }).where(and(eq(metalDaily.metal, "XAU"), eq(metalDaily.date, "2026-10-03")));
    await runJobToCompletion(marketsBackfillJob({ from: "2026-10-03", to: "2026-10-03" }), { db: t.db, fetcher, trigger: "cli", now });
    const [kept] = await t.db.select().from(metalDaily).where(and(eq(metalDaily.metal, "XAU"), eq(metalDaily.date, "2026-10-03")));
    expect(kept?.source).toBe("gold-api");
  });
});
