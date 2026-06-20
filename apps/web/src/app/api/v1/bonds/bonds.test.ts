import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import { draws } from "@bondcheck/db";
import { sha256Hex } from "@bondcheck/ingest";
import { commitDraw } from "@bondcheck/ingest/bonds/commit";
import { candidatesFromDocument, listingIndex, type StoredDocument } from "@bondcheck/ingest/bonds/documents";
import { fixtureBytes, fixtureText, officialFileUrl } from "@bondcheck/ingest/bonds/fixtures";
import { clusterCandidates, decideDraw } from "@bondcheck/ingest/bonds/reconcile";
import { seedBondReference } from "@bondcheck/ingest/bonds/seed";
import { storeDocument } from "@bondcheck/ingest/bonds/documents";
import { bondsEndpoints, envelope, apiErrorSchema } from "@bondcheck/shared";
import { checkResponseExtraSchema } from "@bondcheck/shared/api/bonds-extra";
import { dbRepo, setBondsRepoForTests, type BondsRepo } from "@/features/bonds/server/repo";
import { GET as getDenominations } from "./denominations/route";
import { GET as getDraws } from "./draws/route";
import { GET as getDraw } from "./draws/[denomination]/[drawNumber]/route";
import { GET as getResults } from "./draws/[denomination]/[drawNumber]/results/route";
import { GET as getResultsText } from "./draws/[denomination]/[drawNumber]/results.txt/route";
import { GET as getLatest } from "./latest/route";
import { GET as getSchedule } from "./schedule/route";
import { GET as getCoverage } from "./coverage/route";
import { POST as postCheck } from "./check/route";

let t: TestDb;
const E = bondsEndpoints;

/** Official recorded documents for three draws: Rs 750 no. 107, Rs 200 no. 107, Premium 25000 no. 23. */
const FILES = [
  ["rs-750-prize-bond-draw", "2026_07_Rs-750-107-draw.txt"],
  ["rs-200-prize-bond-draw", "2026_09_200_150926.txt"],
  ["premium-prize-bond-rs-25000", "2026_09_25000_100926-1.txt"],
  ["rs-750-prize-bond-draw", "2026_01_DRAW-RESULT-OF-RS.-750-DENOMINATION-105.txt"],
] as const;

async function doc(rel: string, url: string): Promise<StoredDocument> {
  return { sha256: await sha256Hex(fixtureBytes(rel)), source: "savings_gov_pk", url, fetchedAt: new Date("2026-10-15T00:00:00Z"), contentType: "text/plain", bytes: null, body: fixtureText(rel) };
}

beforeAll(async () => {
  t = await createTestDb();
  await seedBondReference(t.db);
  const pages = await Promise.all(
    [...new Set(FILES.map(([p]) => p))].map((p) => doc(`savings_gov_pk/pages/${p}.html`, `https://savings.gov.pk/${p}`)),
  );
  const files = await Promise.all(FILES.map(([, f]) => doc(`savings_gov_pk/files/${f}`, officialFileUrl(f))));
  for (const d of [...pages, ...files]) await storeDocument(t.db, d);
  const listing = listingIndex(pages);
  const { clusters } = clusterCandidates(files.flatMap((d) => candidatesFromDocument(d, { listing })));
  for (const c of clusters) await commitDraw(t.db, await decideDraw(c.candidates, "2026-10-16"), new Date());
  await t.db.insert(draws).values({ denominationCode: "1500", drawDate: "2026-11-16", drawNumber: 108, city: "Hyderabad", status: "scheduled", completeness: "none" });
  setBondsRepoForTests(dbRepo(t.db));
}, 300_000);

afterAll(() => setBondsRepoForTests(null));

const req = (path: string, init?: RequestInit) => new Request(`http://localhost/api/v1${path}`, init);
const ctx = (denomination: string, drawNumber: string) => ({ params: Promise.resolve({ denomination, drawNumber }) });
const check = (body: unknown, ip = "203.0.113.7") =>
  postCheck(req("/bonds/check", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": ip } }));

describe("bond API contracts", () => {
  it("GET /bonds/denominations", async () => {
    const res = await getDenominations();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=3600/);
    const body = envelope(E.listDenominations.response).parse(await res.json());
    expect(body.data.map((d) => d.code)).toEqual(["100", "200", "750", "1500", "25000P", "40000P", "7500", "15000", "25000", "40000"]);
  });

  it("GET /bonds/draws with filters and keyset pagination", async () => {
    const res = await getDraws(req("/bonds/draws?denomination=750"));
    const body = envelope(E.listDraws.response, E.listDraws.meta).parse(await res.json());
    expect(body.data.map((d) => d.drawNumber)).toEqual([107, 105]);
    expect((body.meta as { nextCursor: string | null } | undefined)?.nextCursor).toBeNull();
    const premium = envelope(E.listDraws.response).parse(await (await getDraws(req("/bonds/draws?denomination=premium-25000&year=2026"))).json());
    expect(premium.data).toHaveLength(1);
    expect((await getDraws(req("/bonds/draws?denomination=999"))).status).toBe(400);
    expect((await getDraws(req("/bonds/draws?cursor=%%%"))).status).toBe(400);
  });

  it("GET /bonds/draws/{denomination}/{drawNumber}", async () => {
    const res = await getDraw(req("/bonds/draws/750/107"), ctx("750", "107"));
    expect(res.status).toBe(200);
    const { data } = envelope(E.getDraw.response).parse(await res.json());
    expect(data).toMatchObject({ drawNumber: 107, drawDate: "2026-07-15", status: "verified", completeness: "full", tier1: ["976106"], notice: null });
    expect(data.tier2).toEqual(["350211", "604285", "607262"]);
    expect(data.prizes).toEqual([
      { tier: 1, amountPkr: 1_500_000, winnersCount: 1, inferred: false },
      { tier: 2, amountPkr: 500_000, winnersCount: 3, inferred: false },
      { tier: 3, amountPkr: 9_300, winnersCount: 1696, inferred: false },
    ]);
    expect(data.sources[0]).toMatchObject({ source: "savings_gov_pk", role: "primary", parsedCount: 1700 });
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=86400/);
    expect((await getDraw(req("/bonds/draws/750/999"), ctx("750", "999"))).status).toBe(404);
    const bad = await getDraw(req("/bonds/draws/750/abc"), ctx("750", "abc"));
    expect(bad.status).toBe(400);
    apiErrorSchema.parse(await bad.json());
  });

  it("GET .../results paginates by tier", async () => {
    const res = await getResults(req("/bonds/draws/750/107/results?tier=3&page=2&pageSize=500"), ctx("750", "107"));
    const body = envelope(E.listDrawResults.response, E.listDrawResults.meta).parse(await res.json());
    expect(body.meta).toEqual({ page: 2, pageSize: 500, total: 1696 });
    expect(body.data).toHaveLength(500);
    expect(body.data.every((r) => r.tier === 3)).toBe(true);
  });

  it("GET .../results.txt is the canonical list whose sha256 is the draw checksum", async () => {
    const res = await getResultsText(req("/bonds/draws/750/107/results.txt"), ctx("750", "107"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    expect(res.headers.get("cache-control")).toMatch(/immutable/);
    const text = await res.text();
    expect(text.split("\n")[0]).toBe("1:976106");
    const { data } = envelope(E.getDraw.response).parse(await (await getDraw(req("/x"), ctx("750", "107"))).json());
    expect(await sha256Hex(text)).toBe(data.resultChecksum);
  });

  it("GET /bonds/latest gives one draw per denomination", async () => {
    const body = envelope(E.latestDraws.response).parse(await (await getLatest()).json());
    expect(body.data.map((d) => `${d.denominationCode}:${d.drawNumber}`).sort()).toEqual(["200:107", "25000P:23", "750:107"]);
  });

  it("GET /bonds/schedule lists held and scheduled draws of a year", async () => {
    const body = envelope(E.getSchedule.response).parse(await (await getSchedule(req("/bonds/schedule?year=2026"))).json());
    expect(body.data.year).toBe(2026);
    expect(body.data.draws.map((d) => d.status)).toContain("scheduled");
    expect((await getSchedule(req("/bonds/schedule?year=1800"))).status).toBe(400);
  });

  it("GET /bonds/coverage has a row per denomination and year since 1999", async () => {
    const body = envelope(E.getCoverage.response).parse(await (await getCoverage()).json());
    const y = Number(new Date().toISOString().slice(0, 4));
    expect(body.data).toHaveLength(10 * (y - 1999 + 1));
    expect(body.data.find((r) => r.denominationCode === "750" && r.year === 2026)).toMatchObject({ full: 2, verified: 2 });
  });
});

describe("POST /bonds/check", () => {
  it("finds a known winning number from the official file", async () => {
    const res = await check({ items: [{ number: "976106" }, { number: "000001" }] }, "198.51.100.1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = await res.json();
    envelope(E.checkBonds.response).parse(json);
    const body = checkResponseExtraSchema.parse(json.data);
    expect(body.checked).toBe(2);
    expect(body.wins).toEqual([
      { bondNumber: "976106", denominationCode: "750", drawId: expect.any(Number), drawNumber: 107, drawDate: "2026-07-15", tier: 1, amountPkr: 1_500_000, amountKnown: true, status: "verified" },
    ]);
  });

  it("expands ranges and honours the denomination filter", async () => {
    // 000381 and 000699 are third prizes of Rs 750 draw 107.
    const all = checkResponseExtraSchema.parse((await (await check({ items: [{ from: "000380", to: "000700" }] }, "198.51.100.2")).json()).data);
    expect(all.checked).toBe(321);
    expect(all.wins.map((w) => w.bondNumber)).toEqual(expect.arrayContaining(["000381", "000699"]));
    const filtered = checkResponseExtraSchema.parse((await (await check({ items: [{ from: "000380", to: "000700", denomination: "200" }] }, "198.51.100.2")).json()).data);
    expect(filtered.wins.every((w) => w.denominationCode === "200")).toBe(true);
  });

  it("rejects invalid input with stable error codes", async () => {
    const cases: unknown[] = [
      { items: [] },
      { items: [{ number: "12345" }] },
      { items: [{ number: "123456", from: "000001", to: "000002" }] },
      { items: [{ from: "000001", to: "001001" }] },
      { items: [{ number: "123456", denomination: "999" }] },
    ];
    for (const body of cases) {
      const res = await check(body, "198.51.100.3");
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(apiErrorSchema.parse(await res.json()).error.code).toBe("bad_request");
    }
    const notJson = await postCheck(req("/bonds/check", { method: "POST", body: "{", headers: { "x-forwarded-for": "198.51.100.3" } }));
    expect(notJson.status).toBe(400);
  });

  it("checks 1,000 numbers in well under 300 ms", async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ number: String(i * 997).padStart(6, "0") }));
    await check({ items }, "198.51.100.4");
    const started = performance.now();
    const res = await check({ items }, "198.51.100.4");
    const elapsed = performance.now() - started;
    expect(res.status).toBe(200);
    expect(checkResponseExtraSchema.parse((await res.json()).data).checked).toBe(1000);
    expect(elapsed).toBeLessThan(300);
  });

  it("rate limits a client after 20 checks a minute without storing its address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await check({ items: [{ number: "123456" }] }, "192.0.2.55")).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    const limited = await check({ items: [{ number: "123456" }] }, "192.0.2.55");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    const keys = await t.client.query<{ key: string }>("select key from rate_limits");
    expect(keys.rows.some((r) => r.key.includes("192.0.2.55"))).toBe(false);
    // Another client is not affected.
    expect((await check({ items: [{ number: "123456" }] }, "192.0.2.56")).status).toBe(200);
  });

  it("answers 503 with a safe message when the data source fails", async () => {
    const broken = new Proxy({} as BondsRepo, {
      // `then` must stay undefined or the proxy would look like a promise when awaited.
      get: (_t, prop) => (prop === "db" || prop === "then" ? undefined : () => Promise.reject(new Error("connection refused at 10.0.0.1"))),
    });
    setBondsRepoForTests(broken);
    try {
      const res = await getLatest();
      expect(res.status).toBe(503);
      const body = apiErrorSchema.parse(await res.json());
      expect(body.error.code).toBe("unavailable");
      expect(body.error.message).not.toMatch(/10\.0\.0\.1/);
    } finally {
      setBondsRepoForTests(dbRepo(t.db));
    }
  });
});
