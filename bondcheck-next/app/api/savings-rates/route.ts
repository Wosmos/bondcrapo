import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getLatestSavingsRates } from "@/lib/scrapers/savings-rates";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "savings-rates");
  if (!rl.success) return rl.response!;

  try {
    const data = await getLatestSavingsRates();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
