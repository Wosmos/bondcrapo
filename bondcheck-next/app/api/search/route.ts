import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { winners } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 5, 3, "search");
  if (!rl.success) return rl.response!;
  const number = request.nextUrl.searchParams.get("number");

  if (!number || number.length < 6 || number.length > 6) {
    return NextResponse.json(
      { error: "number must be exactly 6 digits" },
      { status: 400 }
    );
  }

  try {
    const results = await db
      .select({
        source: winners.source,
        denomination: winners.denomination,
        draw_date: winners.drawDate,
        draw_year: winners.drawYear,
        bond_number: winners.bondNumber,
        prize_position: winners.prizePosition,
        prize_amount: winners.prizeAmount,
      })
      .from(winners)
      .where(eq(winners.bondNumber, number))
      .orderBy(desc(winners.drawDate));

    return NextResponse.json({
      bond_number: number,
      wins: results,
      total_wins: results.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
