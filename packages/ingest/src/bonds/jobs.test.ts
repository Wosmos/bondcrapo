import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drawResults, draws } from "@bondcheck/db";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import { Fetcher } from "../fetcher";
import { runJob } from "../run-job";
import { fakeNetwork, fakePoster, type FakeNetwork } from "./fixtures";
import { createBondJobs } from "./jobs";
import { seedBondReference } from "./seed";

let t: TestDb;

function jobs(net: FakeNetwork) {
  const [sync, verify, schedule] = createBondJobs({ poster: () => fakePoster(net) });
  return { sync: sync!, verify: verify!, schedule: schedule! };
}

const run = (job: Parameters<typeof runJob>[0], net: FakeNetwork, now: string) =>
  runJob(job, {
    db: t.db,
    fetcher: new Fetcher({ userAgent: "TestBot/1.0", fetch: net.fetch, sleep: async () => undefined, minIntervalMs: 0, maxRetries: 0 }),
    trigger: "gha",
    now: () => new Date(now),
  });

beforeAll(async () => {
  t = await createTestDb();
  await seedBondReference(t.db);
  await t.db.insert(draws).values({ denominationCode: "750", drawDate: "2026-07-15", status: "scheduled", completeness: "none" });
}, 300_000);

describe("bonds-sync", () => {
  it("is a no-op on a day without a draw and touches no external site", async () => {
    const net = fakeNetwork();
    const r = await run(jobs(net).sync, net, "2026-07-25T08:00:00Z");
    expect(r.status).toBe("ok");
    expect(r.stats).toMatchObject({ noop: true });
    expect(net.requests).toEqual([]);
  });

  it("ingests the official file on draw day and verifies the draw", async () => {
    const net = fakeNetwork();
    const r = await run(jobs(net).sync, net, "2026-07-15T10:00:00Z");
    expect(r.status).toBe("ok");
    expect(r.stats).toMatchObject({ drawsChanged: 1 });
    expect(net.requests).toEqual([
      "https://savings.gov.pk/rs-750-prize-bond-draw",
      "https://savings.gov.pk/wp-content/uploads/2026/07/Rs-750-107-draw.txt",
    ]);
    const [d] = await t.db.select().from(draws).where(and(eq(draws.denominationCode, "750"), eq(draws.drawDate, "2026-07-15")));
    expect(d).toMatchObject({ status: "verified", completeness: "full", drawNumber: 107 });
    const results = await t.db.select().from(drawResults).where(eq(drawResults.drawId, d!.id));
    expect(results).toHaveLength(1700);
    expect((r.stats.committed as unknown[]).length).toBe(1);
  });

  it("stops polling once the draw is complete", async () => {
    const net = fakeNetwork();
    const r = await run(jobs(net).sync, net, "2026-07-16T10:00:00Z");
    expect(r.stats).toMatchObject({ noop: true });
    expect(net.requests).toEqual([]);
  });
});

describe("bonds-verify", () => {
  it("re-fetches recent official files and changes nothing when they are unchanged", async () => {
    const net = fakeNetwork();
    const r = await run(jobs(net).verify, net, "2026-09-20T03:00:00Z");
    expect(r.status).toBe("ok");
    expect(r.stats).toMatchObject({ drawsChanged: 0, drawsCreated: 0 });
    expect(net.requests).toContain("https://savings.gov.pk/wp-content/uploads/2026/07/Rs-750-107-draw.txt");
  });
});

describe("bonds-schedule", () => {
  it("creates scheduled draws from the official date lists and the yearly schedule", async () => {
    const net = fakeNetwork();
    const r = await run(jobs(net).schedule, net, "2026-10-16T03:00:00Z");
    expect(r.status).toBe("ok");
    expect(net.requests.filter((u) => u.startsWith("POST"))).toHaveLength(6);
    const upcoming = await t.db.select().from(draws).where(eq(draws.status, "scheduled"));
    expect(upcoming.map((d) => `${d.denominationCode}:${d.drawDate}:${d.drawNumber}:${d.city}`)).toEqual(
      expect.arrayContaining(["1500:2026-11-16:108:Hyderabad", "100:2026-11-16:56:Faisalabad", "200:2026-12-15:108:Peshawar"]),
    );
    // The ingested draw keeps its results and gains the calendar documents as corroboration.
    const [d] = await t.db.select().from(draws).where(and(eq(draws.denominationCode, "750"), eq(draws.drawDate, "2026-07-15")));
    expect(d).toMatchObject({ status: "verified", completeness: "full" });
  });
});
