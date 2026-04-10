import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getUpcomingDraws,
  getRecentDraws,
  getNextDrawPerDenomination,
} from "@/lib/scrapers/draw-schedule";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "draw-schedule");
  if (!rl.success) return rl.response!;

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode") ?? "all";

  try {
    if (mode === "next") {
      const byDenom = await getNextDrawPerDenomination();
      return NextResponse.json({ next_draws: byDenom });
    }

    const [upcoming, recent] = await Promise.all([
      getUpcomingDraws(20),
      getRecentDraws(10),
    ]);

    return NextResponse.json({ upcoming, recent });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
