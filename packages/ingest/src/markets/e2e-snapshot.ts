/**
 * Builds the market data snapshot the web end to end tests run against
 * (apps/web/src/features/markets/e2e/snapshot.json): the real jobs run on the recorded fixtures
 * in an in-memory PGlite database, then the tables are dumped as JSON. No network access.
 *
 *   tsx src/markets/e2e-snapshot.ts <output.json>
 */
import { writeFileSync } from "node:fs";
import { fxDaily, fxPkrMarket, localRates, metalDaily, metalSpot } from "@bondcheck/db";
import { createTestDb } from "@bondcheck/db/testing";
import { runJob, runJobToCompletion } from "../run-job";
import { marketsBackfillJob } from "./backfill";
import { fxDailyJob, metalsSpotJob, pkMarketJob } from "./jobs";
import { POPULAR_PKR_PAIRS } from "./currencies";
import { fixtureFetcher } from "./testing";

const NOW = new Date("2026-10-15T14:00:00Z");
const HISTORY = new Set([...POPULAR_PKR_PAIRS, "PKR", "INR", "AED", "SAR", "QAR", "KWD", "OMR", "BHD", "GBP", "EUR"]);

async function main(out: string): Promise<void> {
  const t = await createTestDb({ fresh: true });
  const opts = () => ({ db: t.db, fetcher: fixtureFetcher().fetcher, trigger: "manual" as const, now: () => NOW });
  await runJobToCompletion(marketsBackfillJob({ from: "2026-08-31", to: "2026-10-14" }), opts());
  for (const job of [metalsSpotJob({}), fxDailyJob({}), pkMarketJob({})]) {
    const r = await runJob(job, opts());
    if (r.status === "failed") throw new Error(`${job.name} failed: ${JSON.stringify(r.stats)}`);
  }
  const iso = <T extends { observedAt: Date }>(rows: T[]) => rows.map((r) => ({ ...r, observedAt: r.observedAt.toISOString() }));
  const num = (v: string) => Number(v);
  const snapshot = {
    metalSpot: iso(await t.db.select().from(metalSpot)).map((r) => ({ ...r, priceUsdPerOz: num(r.priceUsdPerOz) })),
    metalDaily: (await t.db.select().from(metalDaily)).map((r) => ({
      metal: r.metal,
      date: r.date,
      open: num(r.openUsd),
      high: num(r.highUsd),
      low: num(r.lowUsd),
      close: num(r.closeUsd),
      source: r.source,
    })),
    // Every currency on the newest day, history only for the currencies the pages chart.
    fxDaily: (await t.db.select().from(fxDaily))
      .filter((r) => r.date === "2026-10-15" || HISTORY.has(r.quote))
      .map((r) => ({ ...r, rateFromUsd: num(r.rateFromUsd) })),
    fxPkrMarket: iso(await t.db.select().from(fxPkrMarket)).map((r) => ({ ...r, buy: num(r.buy), sell: num(r.sell) })),
    localRates: iso(await t.db.select().from(localRates)).map((r) => ({ ...r, price: num(r.price) })),
  };
  writeFileSync(out, `${JSON.stringify(snapshot)}\n`);
  await t.close();
  console.log(`wrote ${out}: ${Object.entries(snapshot).map(([k, v]) => `${k}=${v.length}`).join(" ")}`);
}

const out = process.argv[2];
if (!out) {
  console.error("usage: e2e-snapshot.ts <output.json>");
  process.exit(2);
}
void main(out);
