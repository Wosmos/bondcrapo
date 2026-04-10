import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/schema";
import { desc, eq, and, gte } from "drizzle-orm";

// ── Forex rates via Frankfurter API (free, no key) ───────
// ECB-sourced, updates daily on business days
// Supports: USD, EUR, GBP, SAR, AED, CAD, AUD, etc.

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

// Currencies Pakistani users care about (remittance corridors)
const TARGET_CURRENCIES = ["PKR"] as const;
const BASE_CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "CAD", "AUD"] as const;

/**
 * Fetch latest exchange rates against PKR from Frankfurter API.
 */
export async function fetchForexRates(): Promise<{
  inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    // Frankfurter doesn't support PKR directly as a base.
    // Fetch rates with USD as base, then derive all-to-PKR.
    const res = await fetch(
      `${FRANKFURTER_BASE}/latest?base=USD&symbols=PKR,EUR,GBP,SAR,AED,CAD,AUD`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      errors.push(`Frankfurter API returned ${res.status}`);
      return { inserted, errors };
    }

    const data = await res.json() as {
      base: string;
      date: string;
      rates: Record<string, number>;
    };

    if (!data.rates?.PKR) {
      errors.push("PKR rate not found in Frankfurter response");
      return { inserted, errors };
    }

    const pkrPerUsd = data.rates.PKR;
    const now = new Date();

    // Insert USD/PKR directly
    await db.insert(exchangeRates).values({
      baseCurrency: "USD",
      quoteCurrency: "PKR",
      rateType: "interbank",
      rate: String(pkrPerUsd),
      source: "frankfurter_ecb",
      recordedAt: now,
    });
    inserted++;

    // Derive other currencies to PKR
    // If 1 USD = X PKR and 1 USD = Y EUR, then 1 EUR = X/Y PKR
    for (const currency of BASE_CURRENCIES) {
      if (currency === "USD") continue;

      const rateVsUsd = data.rates[currency];
      if (!rateVsUsd) continue;

      const rateToPkr = Math.round((pkrPerUsd / rateVsUsd) * 10000) / 10000;

      await db.insert(exchangeRates).values({
        baseCurrency: currency,
        quoteCurrency: "PKR",
        rateType: "interbank",
        rate: String(rateToPkr),
        source: "frankfurter_ecb",
        recordedAt: now,
      });
      inserted++;
    }
  } catch (err) {
    errors.push(`Forex fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { inserted, errors };
}

/**
 * Get the latest exchange rates from the database.
 */
export async function getLatestForexRates() {
  const latest = await db
    .select()
    .from(exchangeRates)
    .where(eq(exchangeRates.quoteCurrency, "PKR"))
    .orderBy(desc(exchangeRates.recordedAt))
    .limit(1);

  if (latest.length === 0) return { rates: [], updated_at: null };

  const latestTime = latest[0].recordedAt;

  const rates = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.quoteCurrency, "PKR"),
        eq(exchangeRates.recordedAt, latestTime)
      )
    );

  return {
    rates: rates.map((r) => ({
      base_currency: r.baseCurrency,
      quote_currency: r.quoteCurrency,
      rate_type: r.rateType,
      rate: Number(r.rate),
      recorded_at: r.recordedAt.toISOString(),
    })),
    source: "frankfurter_ecb",
    updated_at: latestTime.toISOString(),
  };
}

/**
 * Get forex rate history for charting.
 */
export async function getForexHistory(
  baseCurrency: string = "USD",
  days: number = 30
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      rate: exchangeRates.rate,
      recordedAt: exchangeRates.recordedAt,
    })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.baseCurrency, baseCurrency.toUpperCase()),
        eq(exchangeRates.quoteCurrency, "PKR"),
        gte(exchangeRates.recordedAt, since)
      )
    )
    .orderBy(exchangeRates.recordedAt);

  return rows.map((r) => ({
    rate: Number(r.rate),
    recorded_at: r.recordedAt.toISOString(),
  }));
}
