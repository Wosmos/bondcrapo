import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { winners } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "latest");
  if (!rl.success) return rl.response!;
  const denomination = request.nextUrl.searchParams.get("denomination");

  try {
    const query = db
      .selectDistinct({
        draw_date: winners.drawDate,
        draw_year: winners.drawYear,
        denomination: winners.denomination,
      })
      .from(winners);

    const results = denomination
      ? await query
          .where(eq(winners.denomination, parseInt(denomination)))
          .orderBy(desc(winners.drawDate))
          .limit(10)
      : await query.orderBy(desc(winners.drawDate)).limit(20);

    return NextResponse.json({ latest_draws: results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
