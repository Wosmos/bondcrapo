import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { devices, events, walletBonds, winners } from "@/lib/schema";
import { count, sql, eq } from "drizzle-orm";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "bondcheck2026";

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // Check cookie first
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("bcp_admin_auth");
  if (authCookie?.value === "authenticated") return true;

  // Check basic auth
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6));
    const [user, pass] = decoded.split(":");
    if (user === ADMIN_USER && pass === ADMIN_PASS) return true;
  }

  return false;
}

let cachedStats: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedStats.data);
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalDevices,
      totalEvents,
      totalBonds,
      totalPrizes,
      activeToday,
      eventsByType,
      deviceTypeBreakdown,
    ] = await Promise.all([
      db.select({ value: count() }).from(devices),
      db.select({ value: count() }).from(events),
      db.select({ value: count() }).from(walletBonds),
      db.select({ value: count() }).from(winners),
      db
        .select({ value: sql<number>`COUNT(DISTINCT ${events.deviceFingerprint})` })
        .from(events)
        .where(sql`${events.createdAt}::date = ${today}`),
      db
        .select({
          eventType: events.eventType,
          total: count(),
        })
        .from(events)
        .groupBy(events.eventType)
        .orderBy(sql`COUNT(*) DESC`),
      db
        .select({
          deviceType: devices.deviceType,
          total: count(),
        })
        .from(devices)
        .groupBy(devices.deviceType)
        .orderBy(sql`COUNT(*) DESC`),
    ]);

    const response = {
      totalDevices: totalDevices[0]?.value ?? 0,
      totalEvents: totalEvents[0]?.value ?? 0,
      totalBonds: totalBonds[0]?.value ?? 0,
      totalPrizes: totalPrizes[0]?.value ?? 0,
      activeToday: activeToday[0]?.value ?? 0,
      eventsByType,
      deviceTypeBreakdown,
    };

    cachedStats = { data: response, timestamp: Date.now() };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
