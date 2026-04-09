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
    const raw = await db
      .select({
        source: winners.source,
        denomination: winners.denomination,
        draw_number: winners.drawNumber,
        draw_date: winners.drawDate,
        draw_year: winners.drawYear,
        city: winners.city,
        bond_number: winners.bondNumber,
        prize_position: winners.prizePosition,
        prize_amount: winners.prizeAmount,
      })
      .from(winners)
      .where(eq(winners.bondNumber, number))
      .orderBy(desc(winners.drawDate));

    // Deduplicate across sources — same draw+bond = one result
    const seen = new Set<string>();
    const results = raw.filter((r) => {
      const key = `${r.denomination}-${r.draw_date}-${r.bond_number}-${r.prize_position}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      bond_number: number,
      wins: results,
      total_wins: results.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
