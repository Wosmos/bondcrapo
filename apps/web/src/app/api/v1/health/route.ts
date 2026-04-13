import { desc, max, sql } from "drizzle-orm";
import { draws, ingestionRuns, metalSpot } from "@bondcheck/db/schema";
import { getDb } from "@/server/db";
import { jsonResponse } from "@/server/http";

export const dynamic = "force-dynamic";

type Health = {
  status: "ok" | "degraded";
  database: "ok" | "unreachable" | "unconfigured";
  lastRuns: Record<string, { status: string; finishedAt: string | null }>;
  freshness: { latestDrawDate: string | null; latestMetalObservedAt: string | null };
};

/** DB ping, last run per job and data freshness. Never exposes secrets or row contents. */
export async function GET() {
  const health: Health = {
    status: "ok",
    database: "ok",
    lastRuns: {},
    freshness: { latestDrawDate: null, latestMetalObservedAt: null },
  };
  if (!process.env.DATABASE_URL) {
    health.database = "unconfigured";
    health.status = "degraded";
    return jsonResponse(health);
  }
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    const runs = await db
      .selectDistinctOn([ingestionRuns.job], {
        job: ingestionRuns.job,
        status: ingestionRuns.status,
        finishedAt: ingestionRuns.finishedAt,
      })
      .from(ingestionRuns)
      .orderBy(ingestionRuns.job, desc(ingestionRuns.startedAt));
    for (const r of runs) {
      health.lastRuns[r.job] = { status: r.status, finishedAt: r.finishedAt?.toISOString() ?? null };
    }
    const [draw] = await db.select({ d: max(draws.drawDate) }).from(draws);
    const [metal] = await db.select({ t: max(metalSpot.observedAt) }).from(metalSpot);
    health.freshness.latestDrawDate = draw?.d ?? null;
    health.freshness.latestMetalObservedAt = metal?.t ? new Date(metal.t).toISOString() : null;
  } catch {
    health.database = "unreachable";
    health.status = "degraded";
  }
  return jsonResponse(health);
}
