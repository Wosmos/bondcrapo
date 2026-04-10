import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getLatestForexRates, getForexHistory } from "@/lib/scrapers/forex";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "forex");
  if (!rl.success) return rl.response!;

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode") ?? "latest";

  try {
    if (mode === "history") {
      const base = searchParams.get("base") ?? "USD";
      const days = Math.min(Number(searchParams.get("days")) || 30, 365);

      const history = await getForexHistory(base, days);
      return NextResponse.json({ history, base_currency: base, days });
    }

    const data = await getLatestForexRates();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
