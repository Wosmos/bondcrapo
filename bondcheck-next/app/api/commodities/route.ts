import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getLatestCommodityPrices } from "@/lib/scrapers/commodities";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "commodities");
  if (!rl.success) return rl.response!;

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") as
    | "fuel"
    | "grocery"
    | null;

  // Validate category if provided
  if (category && category !== "fuel" && category !== "grocery") {
    return NextResponse.json(
      { error: "Invalid category. Use 'fuel' or 'grocery'." },
      { status: 400 }
    );
  }

  try {
    const data = await getLatestCommodityPrices(category ?? undefined);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
