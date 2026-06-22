import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "../testing";
import { drawPrizes, drawResults, draws, prizeStructures, pushSubscriptions, walletBonds, walletMatches, wallets } from "../schema";
import {
  countWalletBonds,
  createPgRateLimiter,
  deleteWalletBond,
  deleteWalletById,
  getWalletProfile,
  insertWallet,
  latestPrizeTables,
  listWalletMatches,
  markNotified,
  markWalletMatchesSeen,
  matchRecentDraws,
  matchWalletBonds,
  pendingNotifications,
  reconcileRecentMatches,
  restoreWalletBySyncCode,
  topWinningNumbers,
  upcomingDrawsFor,
  upsertPushSubscription,
  upsertWalletBonds,
} from "./wallet";

const W1 = "0196a000-0000-7000-8000-000000000001";
const W2 = "0196a000-0000-7000-8000-000000000002";
const NOW = new Date("2026-05-10T10:00:00Z");

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

async function seedDraw(input: {
  denom: string;
  date: string;
  status?: string;
  results: [number, number][];
  prizes?: [number, number, number][];
  updatedAt?: Date;
}): Promise<number> {
  const [d] = await t.db
    .insert(draws)
    .values({
      denominationCode: input.denom,
      drawDate: input.date,
      status: input.status ?? "published",
      completeness: "full",
      updatedAt: input.updatedAt ?? NOW,
      publishedAt: input.updatedAt ?? NOW,
    })
    .returning({ id: draws.id });
  if (input.results.length) {
    await t.db.insert(drawResults).values(input.results.map(([bondNumber, tier]) => ({ drawId: d!.id, bondNumber, tier })));
  }
  if (input.prizes?.length) {
    await t.db
      .insert(drawPrizes)
      .values(input.prizes.map(([tier, amountPkr, winnersCount]) => ({ drawId: d!.id, tier, amountPkr, winnersCount })));
  }
  return d!.id;
}

describe("wallet queries (PGlite)", () => {
  it("covers the wallet lifecycle, matching, analytics inputs and cascade delete", async () => {
    await insertWallet(t.db, { id: W1, tokenHash: "t1", syncCodeHash: "s1", locale: "en", now: NOW });
    await insertWallet(t.db, { id: W2, tokenHash: "t2", syncCodeHash: "s2", now: NOW });

    const drawA = await seedDraw({
      denom: "750",
      date: "2024-01-15",
      results: [
        [111111, 1],
        [222222, 2],
        [333333, 3],
      ],
      prizes: [
        [1, 1_500_000, 1],
        [2, 500_000, 3],
        [3, 9_300, 1_696],
      ],
      updatedAt: new Date("2024-01-15T12:00:00Z"),
    });
    // A 1500 draw without its own prize table falls back to prize_structures.
    await t.db.insert(prizeStructures).values({
      denominationCode: "1500",
      effectiveFrom: "2020-01-01",
      tier: 3,
      amountPkr: 18_500,
      winnersCount: 1_696,
      sourceUrl: "https://savings.gov.pk/example",
    });
    await seedDraw({ denom: "1500", date: "2024-02-15", results: [[333333, 3]], updatedAt: new Date("2024-02-15T12:00:00Z") });
    await seedDraw({ denom: "750", date: "2026-07-15", status: "scheduled", results: [] });

    const added = await upsertWalletBonds(
      t.db,
      W1,
      [
        { denominationCode: "750", bondNumber: 333333, label: "Ammi" },
        { denominationCode: "750", bondNumber: 111112 },
        { denominationCode: "1500", bondNumber: 333333 },
        // Same number, other denomination with no draw: never matches.
        { denominationCode: "200", bondNumber: 222222 },
      ],
      { now: NOW, updateLabels: true },
    );
    expect(added.added).toBe(4);
    const again = await upsertWalletBonds(t.db, W1, [{ denominationCode: "750", bondNumber: 333333, label: "Abbu" }], {
      now: NOW,
      updateLabels: true,
    });
    expect(again.added).toBe(0);
    const skipped = await upsertWalletBonds(t.db, W1, [{ denominationCode: "750", bondNumber: 333333 }], {
      now: NOW,
      updateLabels: false,
    });
    expect(skipped.added).toBe(0);
    const [labelled] = await t.db.select().from(walletBonds).where(eq(walletBonds.bondNumber, 333333)).limit(1);
    expect(["Abbu", null]).toContain(labelled!.label);
    expect(await countWalletBonds(t.db, W1)).toBe(4);

    // All-time check: two wins, stored as already notified.
    expect(await matchWalletBonds(t.db, W1, { now: NOW })).toBe(2);
    expect(await matchWalletBonds(t.db, W1, { now: NOW })).toBe(0);
    const matches = await listWalletMatches(t.db, W1);
    expect(matches.map((m) => [m.denominationCode, m.bondNumber, m.tier, m.amountPkr])).toEqual([
      ["1500", 333333, 3, 18_500],
      ["750", 333333, 3, 9_300],
    ]);
    expect(await pendingNotifications(t.db)).toEqual([]);

    // Incremental: a new draw published now matches W1 and W2, once.
    await upsertWalletBonds(t.db, W2, [{ denominationCode: "750", bondNumber: 444444 }], { now: NOW, updateLabels: false });
    const drawB = await seedDraw({
      denom: "750",
      date: "2026-04-15",
      results: [
        [444444, 2],
        [111112, 3],
      ],
      prizes: [[2, 500_000, 3], [3, 9_300, 1_696]],
    });
    const since = new Date(NOW.getTime() - 3 * 24 * 3600 * 1000);
    const fresh = await matchRecentDraws(t.db, { since, now: NOW });
    expect(fresh.map((m) => [m.walletId, m.bondNumber, m.tier, m.amountPkr]).sort()).toEqual(
      [
        [W1, 111112, 3, 9_300],
        [W2, 444444, 2, 500_000],
      ].sort(),
    );
    expect(await matchRecentDraws(t.db, { since, now: NOW })).toEqual([]);
    const pending = await pendingNotifications(t.db);
    expect(pending).toHaveLength(2);
    expect(pending.find((p) => p.walletId === W1)!.locale).toBe("en");
    await markNotified(t.db, pending, NOW);
    expect(await pendingNotifications(t.db)).toEqual([]);

    // A re-verification moves 111112 to tier 2 and drops 444444.
    await t.db.delete(drawResults).where(eq(drawResults.drawId, drawB));
    await t.db.insert(drawResults).values({ drawId: drawB, bondNumber: 111112, tier: 2 });
    expect(await reconcileRecentMatches(t.db, since)).toBe(2);
    const w2Matches = await listWalletMatches(t.db, W2);
    expect(w2Matches).toEqual([]);
    const w1b = (await listWalletMatches(t.db, W1)).find((m) => m.drawId === drawB)!;
    expect([w1b.tier, w1b.amountPkr]).toEqual([2, 500_000]);

    // Seen flags and profile counts.
    let profile = await getWalletProfile(t.db, W1);
    expect(profile).toMatchObject({ bondCount: 4, matchCount: 3, hasUnseenMatches: true, locale: "en" });
    expect(await markWalletMatchesSeen(t.db, W1, { now: NOW, matches: [{ drawId: drawA, bondNumber: 333333 }] })).toBe(1);
    expect(await markWalletMatchesSeen(t.db, W1, { now: NOW })).toBe(2);
    profile = await getWalletProfile(t.db, W1);
    expect(profile!.hasUnseenMatches).toBe(false);

    // Analytics inputs.
    const top = await topWinningNumbers(t.db, ["750"]);
    expect(top.map((r) => r.bondNumber).sort()).toEqual([111111, 111112, 222222]);
    expect(await latestPrizeTables(t.db, ["750", "1500"])).toEqual({
      "750": [
        { tier: 2, amountPkr: 500_000, winnersCount: 3 },
        { tier: 3, amountPkr: 9_300, winnersCount: 1_696 },
      ],
    });
    expect(await upcomingDrawsFor(t.db, ["750", "1500"], "2026-05-10")).toEqual([
      { denominationCode: "750", drawDate: "2026-07-15", city: null },
    ]);

    // Removing a bond removes its wins in that denomination only.
    expect(await deleteWalletBond(t.db, W1, "750", 333333)).toBe(true);
    expect(await deleteWalletBond(t.db, W1, "750", 333333)).toBe(false);
    expect((await listWalletMatches(t.db, W1)).map((m) => m.denominationCode).sort()).toEqual(["1500", "750"]);

    // Restore swaps both hashes atomically; the old code no longer works.
    expect(
      await restoreWalletBySyncCode(t.db, { syncCodeHash: "s1", newTokenHash: "t1b", newSyncCodeHash: "s1b", now: NOW }),
    ).toBe(W1);
    expect(
      await restoreWalletBySyncCode(t.db, { syncCodeHash: "s1", newTokenHash: "x", newSyncCodeHash: "y", now: NOW }),
    ).toBeNull();

    // Delete cascades to bonds, matches and push subscriptions.
    await upsertPushSubscription(t.db, W1, { platform: "webpush", endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } }, NOW);
    expect(await deleteWalletById(t.db, W1)).toBe(true);
    for (const table of [walletBonds, walletMatches, pushSubscriptions] as const) {
      const rows = await t.db.select().from(table).where(eq(table.walletId, W1));
      expect(rows).toEqual([]);
    }
    expect(await t.db.select().from(wallets).where(eq(wallets.id, W1))).toEqual([]);
    expect(await getWalletProfile(t.db, W1)).toBeNull();
  });

  it("rate limits with a fixed window per key", async () => {
    let now = new Date("2026-05-10T10:00:05Z");
    const limiter = createPgRateLimiter(t.db, () => now);
    const rule = { name: "wallet-restore", limit: 5, windowSeconds: 3600 };
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await limiter.hit(rule, "subject-hash"));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results[4]!.remaining).toBe(0);
    expect(results[5]!.retryAfterSeconds).toBe(3595);
    expect((await limiter.hit(rule, "other-subject")).allowed).toBe(true);
    now = new Date("2026-05-10T11:00:00Z");
    expect((await limiter.hit(rule, "subject-hash")).allowed).toBe(true);
  });
});
