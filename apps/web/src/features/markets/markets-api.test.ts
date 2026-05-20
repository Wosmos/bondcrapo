import { beforeAll, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import { runJob } from "@bondcheck/ingest";
import { fxDailyJob, metalsSpotJob, pkMarketJob } from "@bondcheck/ingest/markets/jobs";
import { fixtureFetcher } from "@bondcheck/ingest/markets/testing";
import { insertMetalDaily, upsertFxDaily } from "@bondcheck/db/queries/markets";
import { apiErrorSchema, envelope, marketsEndpoints, marketsMetaSchema, type AnyEndpoint } from "@bondcheck/shared";

let t: TestDb;
vi.mock("@/server/db", () => ({ getDb: () => t.db }));

import { GET as metalsLatest } from "@/app/api/v1/markets/metals/latest/route";
import { GET as metalsHistory } from "@/app/api/v1/markets/metals/history/route";
import { GET as localRates } from "@/app/api/v1/markets/local-rates/route";
import { GET as fxLatest } from "@/app/api/v1/markets/fx/latest/route";
import { GET as fxPkr } from "@/app/api/v1/markets/fx/pkr/route";
import { GET as fxHistory } from "@/app/api/v1/markets/fx/history/route";
import { GET as convert } from "@/app/api/v1/markets/convert/route";
import { marketsGet } from "./server/route";
import { PgRateLimiter } from "./server/rate-limit";
import { withMarketsRevalidation } from "./jobs";

const NOW = new Date("2026-10-15T14:00:00Z");
const get = (handler: (r: Request) => Promise<Response>, query: string) => handler(new Request(`http://localhost/api/v1/x?${query}`));

type Body<E extends AnyEndpoint> = { data: z.infer<E["response"]>; meta?: z.infer<typeof marketsMetaSchema> };

async function ok<E extends AnyEndpoint>(e: E, res: Response): Promise<Body<E>> {
  expect(res.status, await res.clone().text()).toBe(200);
  const body = envelope(e.response, marketsMetaSchema).parse(await res.json()) as Body<E>;
  expect(res.headers.get("cache-control")).toMatch(/public, s-maxage=\d+, stale-while-revalidate=\d+/);
  return body;
}

async function failsWith(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  const body = apiErrorSchema.parse(await res.json());
  expect(body.error.code).toBe(code);
  return body;
}

beforeAll(async () => {
  t = await createTestDb();
  const env = {};
  for (const job of [metalsSpotJob(env), fxDailyJob(env), pkMarketJob(env)]) {
    const { fetcher } = fixtureFetcher();
    const r = await runJob(job, { db: t.db, fetcher, trigger: "manual", now: () => NOW });
    expect(r.status).not.toBe("failed");
  }
  // a short history: two earlier days of metals and FX
  await insertMetalDaily(t.db, [
    { metal: "XAU", date: "2026-10-13", open: 4183, high: 4183, low: 4183, close: 4183, source: "currency-api" },
    { metal: "XAU", date: "2026-10-14", open: 4153, high: 4153, low: 4153, close: 4153, source: "currency-api" },
  ]);
  await upsertFxDaily(t.db, { date: "2026-10-13", rates: { PKR: 277.1, EUR: 0.89 }, source: "currency-api", overwrite: false });
});

describe("/api/v1/markets contracts", () => {
  it("metals/latest in PKR with change since the previous close and attribution", async () => {
    const body = await ok(marketsEndpoints.metalsLatest, await get(metalsLatest, "currency=PKR"));
    const gold = body.data.find((m) => m.metal === "XAU")!;
    expect(gold.currency).toBe("PKR");
    expect(gold.pricePerOunce).toBeGreaterThan(4170 * 250);
    expect(gold.change24hPct).toBeCloseTo((4170 / 4153 - 1) * 100, 2);
    expect(body.meta?.attribution?.map((a) => a.name)).toEqual(expect.arrayContaining(["Gold API", "ExchangeRate-API"]));
    expect(body.meta?.attribution?.find((a) => a.name === "ExchangeRate-API")?.text).toBe("Rates By Exchange Rate API");
  });

  it("metals/history converts each day at that day's rate", async () => {
    const body = await ok(marketsEndpoints.metalsHistory, await get(metalsHistory, "metal=XAU&currency=PKR&range=max"));
    expect(body.data.points.map((p) => p.date)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(body.data.points[0]!.close).toBeCloseTo(4183 * 277.1, 2);
    // 14 Oct has no FX row: the 13 Oct rate carries forward
    expect(body.data.points[1]!.close).toBeCloseTo(4153 * 277.1, 2);
  });

  it("local-rates returns reported and derived rows for Pakistan", async () => {
    const body = await ok(marketsEndpoints.localRates, await get(localRates, "country=PK"));
    expect(body.data.some((r) => r.kind === "reported" && r.karat === 24 && r.unit === "tola" && r.price === 437836)).toBe(true);
    expect(body.data.some((r) => r.kind === "derived" && r.karat === 21)).toBe(true);
    const ae = await ok(marketsEndpoints.localRates, await get(localRates, "country=AE"));
    expect(ae.data.every((r) => r.kind === "derived" && r.currency === "AED")).toBe(true);
  });

  it("fx/latest rebases to any base currency", async () => {
    const body = await ok(marketsEndpoints.fxLatest, await get(fxLatest, "base=PKR"));
    expect(body.data.base).toBe("PKR");
    expect(body.data.rates.PKR).toBe(1);
    expect(body.data.rates.USD! * (await (await get(fxLatest, "base=USD")).json()).data.rates.PKR).toBeCloseTo(1, 6);
  });

  it("fx/pkr lists open market and interbank quotes, filterable by kind", async () => {
    const all = await ok(marketsEndpoints.fxPkr, await get(fxPkr, ""));
    expect(all.data[0]!.currency).toBe("USD");
    expect(new Set(all.data.map((r) => r.kind))).toEqual(new Set(["open_market", "interbank"]));
    const ib = await ok(marketsEndpoints.fxPkr, await get(fxPkr, "kind=interbank"));
    expect(ib.data.every((r) => r.kind === "interbank" && r.source === "sbp-wacer")).toBe(true);
  });

  it("fx/history and convert", async () => {
    const h = await ok(marketsEndpoints.fxHistory, await get(fxHistory, "base=USD&quote=PKR&range=1m"));
    expect(h.data.points.map((p) => p.date)).toEqual(["2026-10-13", "2026-10-15"]);
    const c = await ok(marketsEndpoints.convert, await get(convert, "from=USD&to=PKR&amount=100"));
    expect(c.data.result).toBeCloseTo(c.data.rate * 100, 4);
    expect(c.data.asOf).toBe("2026-10-15");
  });

  it("rejects invalid input with 400 and unknown currencies with 404", async () => {
    const bad = await failsWith(await get(metalsHistory, "metal=GOLD"), 400, "bad_request");
    expect(JSON.stringify(bad.error.details)).toMatch(/metal/);
    await failsWith(await get(convert, "from=USD&to=PKR&amount=-5"), 400, "bad_request");
    await failsWith(await get(convert, "from=usd&to=PKR&amount=5"), 400, "bad_request");
    await failsWith(await get(fxLatest, "base=ZZZ"), 404, "not_found");
    await failsWith(await get(localRates, "country=FR"), 400, "bad_request");
  });

  it("answers 503 (not 500) when the store cannot be reached", async () => {
    const route = marketsGet(marketsEndpoints.fxLatest, async () => ({ data: null, sources: [] }), {
      store: () => {
        throw new Error("DATABASE_URL is not set");
      },
      limit: async () => null,
    });
    const body = await failsWith(await get(route, "base=USD"), 503, "unavailable");
    expect(body.error.message).not.toMatch(/DATABASE_URL/);
  });

  it("answers 429 with Retry-After when the limiter says so", async () => {
    const route = marketsGet(marketsEndpoints.fxLatest, async () => ({ data: null, sources: [] }), { store: () => ({}) as never, limit: async () => 42 });
    const res = await get(route, "base=USD");
    await failsWith(res, 429, "rate_limited");
    expect(res.headers.get("retry-after")).toBe("42");
  });
});

describe("PgRateLimiter", () => {
  it("counts per fixed window and blocks above the limit", async () => {
    let now = new Date("2026-10-15T10:00:05Z");
    const limiter = new PgRateLimiter(t.db, () => now);
    const rule = { name: "markets-test", limit: 2, windowSeconds: 60 };
    expect((await limiter.hit(rule, "abc")).allowed).toBe(true);
    expect((await limiter.hit(rule, "abc")).allowed).toBe(true);
    const third = await limiter.hit(rule, "abc");
    expect(third).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 55 });
    expect((await limiter.hit(rule, "other")).allowed).toBe(true);
    now = new Date("2026-10-15T10:01:01Z");
    expect((await limiter.hit(rule, "abc")).allowed).toBe(true);
  });
});

describe("cron wrapper", () => {
  it("revalidates the markets tag after a run", async () => {
    const tags: string[][] = [];
    const job = withMarketsRevalidation({ name: "fx-daily", run: async () => ({ done: true, cursor: null, stats: {} }) }, (x) => tags.push([...x]));
    await job.run({} as never, null);
    expect(tags).toEqual([["markets"]]);
  });
});
