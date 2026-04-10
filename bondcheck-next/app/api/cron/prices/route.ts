import { NextRequest, NextResponse } from "next/server";
import { fetchGoldPrices } from "@/lib/scrapers/gold";
import { fetchForexRates } from "@/lib/scrapers/forex";
import { fetchCryptoPrices } from "@/lib/scrapers/crypto";

/**
 * Cron: Fetch gold, forex, and crypto prices.
 * Schedule: Every 5 minutes (configured in vercel.json)
 * Vercel crons require CRON_SECRET header validation.
 */
export async function GET(request: NextRequest) {
  // Validate cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: Record<string, { inserted: number; errors: string[] }> = {};

  // Fetch all price feeds in parallel
  const [gold, forex, crypto] = await Promise.allSettled([
    fetchGoldPrices(),
    fetchForexRates(),
    fetchCryptoPrices(),
  ]);

  results.gold =
    gold.status === "fulfilled"
      ? gold.value
      : { inserted: 0, errors: [String(gold.reason)] };

  results.forex =
    forex.status === "fulfilled"
      ? forex.value
      : { inserted: 0, errors: [String(forex.reason)] };

  results.crypto =
    crypto.status === "fulfilled"
      ? crypto.value
      : { inserted: 0, errors: [String(crypto.reason)] };

  const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
  const totalErrors = Object.values(results).flatMap((r) => r.errors);

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - startTime,
    total_inserted: totalInserted,
    total_errors: totalErrors.length,
    results,
  });
}
