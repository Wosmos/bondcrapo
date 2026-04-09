import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { winners } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { inArray, desc } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, 5, 3, "check-multi");
  if (!rl.success) return rl.response!;
  try {
    const data = await request.json();
    const numbers: string[] = data.numbers || [];

    if (!numbers.length || numbers.length > 100) {
      return NextResponse.json(
        { error: "Provide 1-100 bond numbers" },
        { status: 400 }
      );
    }

    const raw = await db
      .select({
        bond_number: winners.bondNumber,
        denomination: winners.denomination,
        draw_number: winners.drawNumber,
        draw_date: winners.drawDate,
        city: winners.city,
        prize_position: winners.prizePosition,
        prize_amount: winners.prizeAmount,
      })
      .from(winners)
      .where(inArray(winners.bondNumber, numbers))
      .orderBy(winners.bondNumber, desc(winners.drawDate));

    // Deduplicate across sources
    const seen = new Set<string>();
    const rows = raw.filter((r) => {
      const key = `${r.denomination}-${r.draw_date}-${r.bond_number}-${r.prize_position}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const results: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!results[row.bond_number]) {
        results[row.bond_number] = [];
      }
      results[row.bond_number].push(row);
    }

    return NextResponse.json({
      results,
      checked: numbers.length,
      winners: Object.keys(results).length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
