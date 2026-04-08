import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { legacyWinners as winners } from "@bondcheck/db/schema";
import { count, sum, max } from "drizzle-orm";

// Server-side cache - stats barely change, no need to query 960K rows every time
let cachedStats: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {

  // Return cached if fresh
  if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedStats.data);
  }

  try {
    const [totalResult, byDenomination, byPosition, lastUpdateResult] =
      await Promise.all([
        getDb().select({ total: count() }).from(winners),
        getDb()
          .select({
            denomination: winners.denomination,
            count: count(),
            total_amount: sum(winners.prizeAmount),
          })
          .from(winners)
          .groupBy(winners.denomination),
        getDb()
          .select({
            prize_position: winners.prizePosition,
            count: count(),
            total_amount: sum(winners.prizeAmount),
          })
          .from(winners)
          .groupBy(winners.prizePosition),
        getDb().select({ last_update: max(winners.createdAt) }).from(winners),
      ]);

    const response = {
      total_winners: totalResult[0].total,
      by_denomination: byDenomination.map((d) => ({
        denomination: d.denomination,
        count: d.count,
        total_amount: Number(d.total_amount) || 0,
      })),
      by_position: byPosition.map((p) => ({
        prize_position: p.prize_position,
        count: p.count,
        total_amount: Number(p.total_amount) || 0,
      })),
      last_update: lastUpdateResult[0].last_update,
    };

    cachedStats = { data: response, timestamp: Date.now() };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
