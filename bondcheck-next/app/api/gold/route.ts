import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getLatestGoldPrices, getGoldHistory } from "@/lib/scrapers/gold";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "gold");
  if (!rl.success) return rl.response!;

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode") ?? "latest";

  try {
    if (mode === "history") {
      const karat = searchParams.get("karat") ?? "24k";
      const unit = searchParams.get("unit") ?? "tola";
      const days = Math.min(Number(searchParams.get("days")) || 30, 365);

      const history = await getGoldHistory(karat, unit, days);
      return NextResponse.json({ history, karat, unit, days });
    }

    const data = await getLatestGoldPrices();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
