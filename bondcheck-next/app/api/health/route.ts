import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { winners } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 15, 10, "health");
  if (!rl.success) return rl.response!;
  try {
    const result = await db.select({ total: count() }).from(winners);
    return NextResponse.json({
      status: "healthy",
      database: "connected",
      records: result[0].total,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      status: "degraded",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
