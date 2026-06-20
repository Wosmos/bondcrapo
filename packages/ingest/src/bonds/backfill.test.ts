import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drawPrizes, drawResults, draws, drawSources, ingestionRuns, sourceDocuments } from "@bondcheck/db";
import { coverageRows } from "@bondcheck/db/queries/bonds";
import { createTestDb, type TestDb } from "@bondcheck/db/testing";
import type { DenominationCode } from "@bondcheck/shared";
import { Fetcher } from "../fetcher";
import { runJobToCompletion, type RunJobResult } from "../run-job";
import { createBackfillJob } from "./backfill";
import { AUDIT_DRAWS, auditResolutions, buildCoverageMarkdown } from "./coverage";
import { fakeNetwork, fakePoster, loadLegacySample } from "./fixtures";

const CODES: DenominationCode[] = ["100", "200", "750", "1500", "40000", "25000P", "40000P"];
const NOW = new Date("2026-10-16T09:00:00Z");

let t: TestDb;
let first: RunJobResult[];
let second: RunJobResult[];

const total = (runs: RunJobResult[], key: string) => runs.reduce((a, r) => a + (Number(r.stats[key]) || 0), 0);

async function backfill() {
  const net = fakeNetwork();
  const job = createBackfillJob({ denominations: CODES, poster: fakePoster(net), scheduleYears: [2025, 2026], spotBudget: 20 });
  return runJobToCompletion(job, {
    db: t.db,
    fetcher: new Fetcher({ userAgent: "TestBot/1.0", fetch: net.fetch, sleep: async () => undefined, minIntervalMs: 0, maxRetries: 0 }),
    trigger: "cli",
    budgetMs: 600_000,
    now: () => NOW,
  });
}

async function draw(code: string, date: string) {
  const [row] = await t.db.select().from(draws).where(and(eq(draws.denominationCode, code), eq(draws.drawDate, date)));
  if (!row) throw new Error(`no draw ${code} ${date}`);
  const results = await t.db.select().from(drawResults).where(eq(drawResults.drawId, row.id));
  const sources = await t.db
    .select({ role: drawSources.role, source: sourceDocuments.source, url: sourceDocuments.url })
    .from(drawSources)
    .innerJoin(sourceDocuments, eq(sourceDocuments.sha256, drawSources.documentSha256))
    .where(eq(drawSources.drawId, row.id));
  const prizes = await t.db.select().from(drawPrizes).where(eq(drawPrizes.drawId, row.id));
  const tier = (n: number) => results.filter((r) => r.tier === n).map((r) => r.bondNumber).sort((a, b) => a - b);
  return { row, tier, sources, prizes, count: results.length };
}

beforeAll(async () => {
  t = await createTestDb();
  await loadLegacySample(t.db);
  first = await backfill();
  second = await backfill();
}, 900_000);

describe("bond backfill (PGlite, recorded fixtures)", () => {
  it("completes, and a second run changes nothing", () => {
    expect(first[first.length - 1]?.status).toBe("ok");
    expect(total(first, "drawsCreated")).toBeGreaterThan(400);
    expect(second[second.length - 1]?.status).toBe("ok");
    expect(total(second, "changes")).toBe(0);
    expect(total(second, "drawsCreated")).toBe(0);
    expect(total(second, "drawsChanged")).toBe(0);
  });

  it("records the run in ingestion_runs", async () => {
    const runs = await t.db.select().from(ingestionRuns).where(eq(ingestionRuns.job, "bonds-backfill"));
    expect(runs.length).toBe(first.length + second.length);
  });

  it("publishes official draws as verified full lists with the prize table from the file", async () => {
    const d = await draw("750", "2026-07-15");
    expect(d.row).toMatchObject({ status: "verified", completeness: "full", drawNumber: 107, city: "Lahore" });
    expect(d.count).toBe(1700);
    expect(d.tier(1)).toEqual([976106]);
    expect(d.prizes.map((p) => [p.tier, p.amountPkr, p.winnersCount, p.inferred])).toEqual(
      expect.arrayContaining([
        [1, 1_500_000, 1, 0],
        [2, 500_000, 3, 0],
        [3, 9_300, 1696, 0],
      ]),
    );
    expect(d.sources.find((s) => s.role === "primary")?.url).toMatch(/Rs-750-107-draw\.txt$/);
  });

  it("uses the PDF when a draw has no TXT (Rs 200, 15-12-2023, five second prizes)", async () => {
    const d = await draw("200", "2023-12-15");
    expect(d.row).toMatchObject({ status: "verified", completeness: "full" });
    expect(d.tier(1)).toEqual([985380]);
    expect(d.tier(2)).toHaveLength(5);
    expect(d.sources.find((s) => s.role === "primary")?.url).toMatch(/\.pdf$/);
  });

  it("verifies legacy full lists against the official file (checksums agree)", async () => {
    const d = await draw("1500", "2021-11-15");
    expect(d.row).toMatchObject({ status: "verified", completeness: "full" });
    expect(d.sources.filter((s) => s.source === "legacy_db_snapshot").map((s) => s.role)).toEqual(["corroborating"]);
  });

  it("matches sources a day apart into one draw (Rs 200 of 15/16 June 2022)", async () => {
    const rows = await t.db.select().from(draws).where(eq(draws.denominationCode, "200"));
    expect(rows.filter((r) => r.drawDate >= "2022-06-01" && r.drawDate <= "2022-06-30")).toHaveLength(1);
  });

  it("splits Premium 25000 out of the bearer code", async () => {
    const d = await draw("25000P", "2022-03-10");
    expect(d.sources.some((s) => s.source === "legacy_db_snapshot")).toBe(true);
    const bearer = await t.db.select().from(draws).where(and(eq(draws.denominationCode, "25000"), eq(draws.drawDate, "2022-03-10")));
    expect(bearer).toHaveLength(0);
  });

  it("resolves first prize conflicts with the official number search", async () => {
    for (const [date, winner] of [
      ["2013-09-02", 370978],
      ["2016-03-01", 190031],
      ["2017-03-01", 35150],
    ] as const) {
      const d = await draw("40000", date);
      expect(d.tier(1), date).toEqual([winner]);
      expect(d.row.status, date).toBe("verified");
      expect(d.sources.some((s) => s.url.includes("results.php")), date).toBe(true);
    }
  });

  it("never marks a draw verified while valid sources still disagree", async () => {
    const verified = await t.db.select().from(draws).where(eq(draws.status, "verified"));
    for (const v of verified) {
      const roles = await t.db
        .select({ role: drawSources.role, url: sourceDocuments.url })
        .from(drawSources)
        .innerJoin(sourceDocuments, eq(sourceDocuments.sha256, drawSources.documentSha256))
        .where(eq(drawSources.drawId, v.id));
      if (roles.some((r) => r.role === "conflicting")) {
        // A conflicting source on a verified draw was contradicted by the official number search.
        expect(roles.some((r) => r.url.includes("results.php")), `${v.denominationCode} ${v.drawDate}`).toBe(true);
      }
    }
  });

  it("resolves or disputes every draw named in the data audit", async () => {
    const audit = await auditResolutions(t.db);
    expect(audit).toHaveLength(AUDIT_DRAWS.length);
    for (const a of audit.filter((x) => CODES.includes(x.code as DenominationCode))) {
      expect(["verified", "published", "disputed"], `${a.code} ${a.date}`).toContain(a.status);
      if (a.status !== "disputed" && a.completeness !== "none") {
        const near = await nearest(a.code, a.date);
        const firsts = (await t.db.select().from(drawResults).where(and(eq(drawResults.drawId, near.id), eq(drawResults.tier, 1)))).map((r) => r.bondNumber);
        expect(firsts, `${a.code} ${a.date}`).toHaveLength(1);
        expect(firsts, `${a.code} ${a.date}`).not.toContain(3542);
      }
    }
    expect(audit.find((a) => a.code === "1500" && a.date === "2010-11-15")?.status).toBe("disputed");
  });

  it("creates scheduled rows for announced future draws", async () => {
    const d = await draw("1500", "2026-11-16");
    expect(d.row).toMatchObject({ status: "scheduled", completeness: "none", drawNumber: 108, city: "Hyderabad" });
  });

  it("reports coverage for every denomination and year from 1999 and renders COVERAGE.md", async () => {
    const rows = await coverageRows(t.db, "2026-10-16");
    expect(rows).toHaveLength(10 * (2026 - 1999 + 1));
    const r750 = rows.filter((r) => r.denominationCode === "750");
    expect(r750.find((r) => r.year === 1999)?.expected).toBe(0);
    expect(r750.find((r) => r.year === 2010)?.expected).toBe(4);
    const md = await buildCoverageMarkdown(t.db, "2026-10-16");
    expect(md).toContain("| 1999 (no source) |");
    expect(md).not.toContain("\u2014");
  });
});

async function nearest(code: string, date: string) {
  const rows = await t.db.select().from(draws).where(eq(draws.denominationCode, code));
  const near = rows.sort((a, b) => Math.abs(Date.parse(a.drawDate) - Date.parse(date)) - Math.abs(Date.parse(b.drawDate) - Date.parse(date)))[0]!;
  return near;
}
