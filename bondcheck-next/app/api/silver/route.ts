import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getLatestSilverPrices } from "@/lib/scrapers/gold";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "silver");
  if (!rl.success) return rl.response!;

  try {
    const data = await getLatestSilverPrices();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
