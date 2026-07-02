import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../testing";
import { draws, sourceDocuments } from "../schema";
import { bondsFreshness } from "./bonds";
import { insertSpotTicks, latestReported, localRatesFor, marketsFreshness, upsertFxDaily, upsertLocalRates, upsertPkrQuotes } from "./markets";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb({ fresh: true });
});

afterAll(async () => {
  await t.close();
});

describe("freshness for the data sources page", () => {
  it("reports the newest held draw and the newest document per source", async () => {
    await t.db.insert(draws).values([
      { denominationCode: "750", drawNumber: 107, drawDate: "2026-07-15", status: "verified", completeness: "full" },
      { denominationCode: "750", drawNumber: 108, drawDate: "2026-10-15", status: "published", completeness: "full" },
      { denominationCode: "750", drawNumber: 109, drawDate: "2027-01-15", status: "scheduled" },
    ]);
    await t.db.insert(sourceDocuments).values([
      { sha256: "a", source: "savings_gov_pk", url: "https://savings.gov.pk/a", fetchedAt: new Date("2026-10-15T12:00:00Z"), body: "" },
      { sha256: "b", source: "savings_gov_pk", url: "https://savings.gov.pk/b", fetchedAt: new Date("2026-10-16T09:00:00Z"), body: "" },
      { sha256: "c", source: "prizeinfo_net", url: "https://prizeinfo.net/c", fetchedAt: new Date("2026-10-14T09:00:00Z"), body: "" },
    ]);
    const f = await bondsFreshness(t.db);
    // the scheduled draw is not counted and does not move the date
    expect(f.heldDraws).toBe(2);
    expect(f.latestDrawDate).toBe("2026-10-15");
    expect(f.documents).toEqual([
      { source: "prizeinfo_net", latestFetchedAt: new Date("2026-10-14T09:00:00Z") },
      { source: "savings_gov_pk", latestFetchedAt: new Date("2026-10-16T09:00:00Z") },
    ]);
  });

  it("reports the newest market row per dataset and source", async () => {
    await insertSpotTicks(t.db, [
      { metal: "XAU", priceUsdPerOz: 4170, observedAt: new Date("2026-10-16T06:00:00Z"), source: "gold-api" },
      { metal: "XAU", priceUsdPerOz: 4175, observedAt: new Date("2026-10-16T07:00:00Z"), source: "gold-api" },
    ]);
    await upsertFxDaily(t.db, { date: "2026-10-15", rates: { PKR: 281 }, source: "er-api", overwrite: false });
    await upsertPkrQuotes(
      t.db,
      [{ currency: "USD", date: "2026-10-16", kind: "open_market", buy: 280, sell: 282, source: "forex-pk", observedAt: new Date("2026-10-16T08:00:00Z") }],
      false,
    );
    await upsertLocalRates(t.db, [
      { country: "PK", city: "", metal: "XAU", karat: 24, unit: "tola", currency: "PKR", price: 437836, kind: "reported", source: "app-apsgja", sourceUrl: "https://www.app.com.pk/business/report", date: "2026-10-15", observedAt: new Date("2026-10-15T10:00:00Z") },
      { country: "PK", city: "", metal: "XAU", karat: 24, unit: "tola", currency: "PKR", price: 434000, kind: "derived", source: "derived", date: "2026-10-16", observedAt: new Date("2026-10-16T07:00:00Z") },
    ]);
    const f = await marketsFreshness(t.db);
    expect(f.spot).toEqual([{ source: "gold-api", latest: new Date("2026-10-16T07:00:00Z") }]);
    expect(f.fx).toEqual([{ source: "er-api", latest: "2026-10-15" }]);
    expect(f.pkr).toEqual([{ kind: "open_market", source: "forex-pk", latest: new Date("2026-10-16T08:00:00Z") }]);
    expect(f.local).toEqual(
      expect.arrayContaining([
        { country: "PK", kind: "reported", source: "app-apsgja", latest: "2026-10-15" },
        { country: "PK", kind: "derived", source: "derived", latest: "2026-10-16" },
      ]),
    );
  });

  it("keeps the report link of a reported rate", async () => {
    const [reported] = await latestReported(t.db, "PK", "2026-10-13");
    expect(reported?.sourceUrl).toBe("https://www.app.com.pk/business/report");
    // the newest day holds only the estimate, which has no report of its own
    const today = await localRatesFor(t.db, "PK", null);
    expect(today.map((r) => [r.kind, r.sourceUrl])).toEqual([["derived", null]]);
  });
});
