import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getLatestCryptoPrices, getCryptoHistory } from "@/lib/scrapers/crypto";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "crypto");
  if (!rl.success) return rl.response!;

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode") ?? "latest";

  try {
    if (mode === "history") {
      const symbol = searchParams.get("symbol") ?? "BTC";
      const days = Math.min(Number(searchParams.get("days")) || 30, 365);

      const history = await getCryptoHistory(symbol, days);
      return NextResponse.json({ history, symbol, days });
    }

    const data = await getLatestCryptoPrices();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
