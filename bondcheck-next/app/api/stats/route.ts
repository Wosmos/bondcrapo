import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { winners } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { count, sum, max } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "stats");
  if (!rl.success) return rl.response!;
  try {
    const [totalResult, byDenomination, byPosition, lastUpdateResult] =
      await Promise.all([
        db.select({ total: count() }).from(winners),
        db
          .select({
            denomination: winners.denomination,
            count: count(),
            total_amount: sum(winners.prizeAmount),
          })
          .from(winners)
          .groupBy(winners.denomination),
        db
          .select({
            prize_position: winners.prizePosition,
            count: count(),
            total_amount: sum(winners.prizeAmount),
          })
          .from(winners)
          .groupBy(winners.prizePosition),
        db.select({ last_update: max(winners.createdAt) }).from(winners),
      ]);

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
