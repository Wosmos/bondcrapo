import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devices } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fingerprint, meta } = body;

    if (!fingerprint || typeof fingerprint !== "string") {
      return NextResponse.json({ error: "Missing fingerprint" }, { status: 400 });
    }

    // IP from headers (Vercel provides these)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    // Upsert: create if new, update last_seen + bump session count if existing
    await db
      .insert(devices)
      .values({
        fingerprint,
        os: meta?.os ?? null,
        browser: meta?.browser ?? null,
        deviceType: meta?.deviceType ?? null,
        screenRes: meta?.screenWidth ? `${meta.screenWidth}x${meta.screenHeight}` : null,
        language: meta?.language ?? null,
        timezone: meta?.timezone ?? null,
        rawMeta: { ...meta, ip },
      })
      .onConflictDoUpdate({
        target: devices.fingerprint,
        set: {
          lastSeen: sql`NOW()`,
          totalSessions: sql`${devices.totalSessions} + 1`,
          os: meta?.os ?? undefined,
          browser: meta?.browser ?? undefined,
          deviceType: meta?.deviceType ?? undefined,
          screenRes: meta?.screenWidth ? `${meta.screenWidth}x${meta.screenHeight}` : undefined,
          language: meta?.language ?? undefined,
          timezone: meta?.timezone ?? undefined,
          rawMeta: { ...meta, ip },
        },
      });

    // Get wallet count for this device
    const device = await db.query.devices.findFirst({
      where: eq(devices.fingerprint, fingerprint),
    });

    return NextResponse.json({
      ok: true,
      deviceId: device?.id,
      totalSessions: device?.totalSessions,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
