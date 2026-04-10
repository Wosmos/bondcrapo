import { db } from "@/lib/db";
import { goldPrices } from "@/lib/schema";
import { desc, eq, and } from "drizzle-orm";

// ── Gold price fetching via goldpricez.com free API ───────
// Free tier: 30-60 requests/hour, supports PKR + tola

const GOLDPRICEZ_BASE = "https://goldpricez.com/api/rates/currency/pkr/measure/tola-pakistan";

interface GoldApiRate {
  price: number;
  curr: string;
  measure: string;
  ts: number;
}

/**
 * Fetch current gold prices from goldpricez.com API.
 * Returns prices in PKR per tola for 24K, 22K, 21K.
 */
export async function fetchGoldPrices(): Promise<{
  inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    const res = await fetch(GOLDPRICEZ_BASE, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      errors.push(`goldpricez API returned ${res.status}`);
      return { inserted, errors };
    }

    const data = await res.json() as GoldApiRate | GoldApiRate[];
    const rates = Array.isArray(data) ? data : [data];

    if (rates.length === 0 || !rates[0]?.price) {
      errors.push("No price data in goldpricez response");
      return { inserted, errors };
    }

    // The API returns 24K price per tola. Derive 22K and 21K.
    const price24k = rates[0].price;
    const price22k = Math.round((price24k * 22) / 24 * 100) / 100;
    const price21k = Math.round((price24k * 21) / 24 * 100) / 100;

    // Also compute per-gram (1 tola = 11.6638 grams)
    const TOLA_TO_GRAM = 11.6638;

    const rows = [
      { karat: "24k", unit: "tola", pricePkr: String(price24k) },
      { karat: "22k", unit: "tola", pricePkr: String(price22k) },
      { karat: "21k", unit: "tola", pricePkr: String(price21k) },
      { karat: "24k", unit: "gram", pricePkr: String(Math.round((price24k / TOLA_TO_GRAM) * 100) / 100) },
      { karat: "22k", unit: "gram", pricePkr: String(Math.round((price22k / TOLA_TO_GRAM) * 100) / 100) },
      { karat: "21k", unit: "gram", pricePkr: String(Math.round((price21k / TOLA_TO_GRAM) * 100) / 100) },
    ];

    const now = new Date();
    for (const row of rows) {
      await db.insert(goldPrices).values({
        source: "goldpricez_api",
        karat: row.karat,
        unit: row.unit,
        pricePkr: row.pricePkr,
        recordedAt: now,
      });
      inserted++;
    }
  } catch (err) {
    errors.push(`Gold fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { inserted, errors };
}

/**
 * Get the latest gold prices from the database.
 */
export async function getLatestGoldPrices() {
  // Get the most recent recorded_at timestamp
  const latest = await db
    .select()
    .from(goldPrices)
    .where(eq(goldPrices.source, "goldpricez_api"))
    .orderBy(desc(goldPrices.recordedAt))
    .limit(1);

  if (latest.length === 0) return { prices: [], updated_at: null };

  const latestTime = latest[0].recordedAt;

  // Get all prices from that timestamp
  const prices = await db
    .select()
    .from(goldPrices)
    .where(
      and(
        eq(goldPrices.source, "goldpricez_api"),
        eq(goldPrices.recordedAt, latestTime)
      )
    );

  return {
    prices: prices.map((p) => ({
      karat: p.karat,
      unit: p.unit,
      price_pkr: Number(p.pricePkr),
      price_usd: p.priceUsd ? Number(p.priceUsd) : null,
      recorded_at: p.recordedAt.toISOString(),
    })),
    updated_at: latestTime.toISOString(),
  };
}

/**
 * Get gold price history for charting.
 */
export async function getGoldHistory(
  karat: string = "24k",
  unit: string = "tola",
  days: number = 30
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { gte } = await import("drizzle-orm");

  const rows = await db
    .select({
      pricePkr: goldPrices.pricePkr,
      recordedAt: goldPrices.recordedAt,
    })
    .from(goldPrices)
    .where(
      and(
        eq(goldPrices.karat, karat),
        eq(goldPrices.unit, unit),
        gte(goldPrices.recordedAt, since)
      )
    )
    .orderBy(goldPrices.recordedAt);

  return rows.map((r) => ({
    price_pkr: Number(r.pricePkr),
    recorded_at: r.recordedAt.toISOString(),
  }));
}
