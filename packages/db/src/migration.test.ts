import { afterEach, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "./testing";
import { denominations, draws, drawResults, legacyWinners, wallets, walletBonds } from "./schema";

let current: TestDb | undefined;
afterEach(async () => {
  await current?.close();
  current = undefined;
});

async function tableNames(t: TestDb): Promise<string[]> {
  const res = await t.client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' order by 1",
  );
  return res.rows.map((r) => r.table_name);
}

describe("foundation migration on an empty database", () => {
  it("creates every table from the plan and seeds denominations", async () => {
    current = await createTestDb();
    const names = await tableNames(current);
    for (const expected of [
      "denominations",
      "prize_structures",
      "draws",
      "draw_prizes",
      "draw_results",
      "source_documents",
      "draw_sources",
      "metal_spot",
      "metal_daily",
      "fx_daily",
      "fx_pkr_market",
      "local_rates",
      "ingestion_runs",
      "ingestion_issues",
      "rate_limits",
      "wallets",
      "wallet_bonds",
      "wallet_matches",
      "push_subscriptions",
      "legacy_winners",
    ]) {
      expect(names).toContain(expected);
    }
    const rows = await current.db.select().from(denominations);
    expect(rows.map((r) => r.code).sort()).toEqual(
      ["100", "1500", "15000", "200", "25000", "25000P", "40000", "40000P", "7500", "750"].sort(),
    );
  });

  it("enforces the draw and result keys", async () => {
    current = await createTestDb();
    const { db } = current;
    const [draw] = await db
      .insert(draws)
      .values({ denominationCode: "750", drawDate: "2026-01-15", drawNumber: 99, status: "published" })
      .returning();
    await db.insert(drawResults).values({ drawId: draw!.id, bondNumber: 12, tier: 1 });
    await expect(
      db.insert(drawResults).values({ drawId: draw!.id, bondNumber: 12, tier: 2 }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(draws)
        .values({ denominationCode: "750", drawDate: "2026-01-15", status: "scheduled" }),
    ).rejects.toThrow();
    // two undrawn-number rows for different dates are fine (partial unique index)
    await db.insert(draws).values({ denominationCode: "750", drawDate: "2026-04-15", status: "scheduled" });
    await db.insert(draws).values({ denominationCode: "750", drawDate: "2026-07-15", status: "scheduled" });
  });

  it("cascades wallet deletion", async () => {
    current = await createTestDb();
    const { db } = current;
    const id = "0195f2c0-0000-7000-8000-000000000001";
    await db.insert(wallets).values({ id, tokenHash: "x" });
    await db.insert(walletBonds).values({ walletId: id, denominationCode: "750", bondNumber: 123456 });
    await db.delete(wallets).where(eq(wallets.id, id));
    const [row] = await db.select({ n: count() }).from(walletBonds);
    expect(row?.n).toBe(0);
  });
});

describe("foundation migration on the pre-rebuild production shapes", () => {
  it("renames winners without losing rows and drops personal data tables", async () => {
    current = await createTestDb({ migrate: false, legacyShapes: true });
    const { client } = current;
    await client.exec(`
      INSERT INTO winners (source, denomination, draw_date, bond_number, prize_position, prize_amount)
        VALUES ('pkprizebond_com', 750, '15-Jan-2020', '123456', '1st', 1500000),
               ('prizeinfo_net', 750, '15 January 2020', '123456', '1st', 1500000);
      INSERT INTO devices (fingerprint, country) VALUES ('fp-1', 'PK');
      INSERT INTO events (device_fingerprint, session_id, event_type, ip) VALUES ('fp-1', 's', 'view', '1.2.3.4');
      INSERT INTO commodity_prices (name, price) VALUES ('petrol', 250);
      INSERT INTO draw_schedule (denomination, draw_date) VALUES (750, '2026-01-15');
    `);

    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { MIGRATIONS_FOLDER } = await import("./testing");
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });

    const names = await tableNames(current);
    expect(names).not.toContain("winners");
    for (const gone of [
      "devices",
      "events",
      "wallet_notifications",
      "analytics_daily",
      "exchange_rates",
      "gold_prices",
      "market_indices",
      "news_articles",
      "price_alerts",
      "savings_rates",
      "commodity_prices",
      "draw_schedule",
    ]) {
      expect(names).not.toContain(gone);
    }
    // non-empty out of band tables are preserved, not destroyed
    expect(names).toContain("legacy_commodity_prices");
    expect(names).toContain("legacy_draw_schedule");

    const rows = await current.db.select().from(legacyWinners);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.bondNumber).toBe("123456");

    // the new wallet_bonds has the anonymous wallet shape
    const cols = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'wallet_bonds'",
    );
    const colNames = cols.rows.map((c) => c.column_name);
    expect(colNames).toContain("wallet_id");
    expect(colNames).not.toContain("device_fingerprint");

    const denoms = await current.db.select().from(denominations);
    expect(denoms).toHaveLength(10);
  });
});
