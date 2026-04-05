import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fingerprint,
      sessionId,
      eventType,
      eventData,
      page,
      referrer,
      screenWidth,
      screenHeight,
      language,
      timezone,
      connectionType,
      batteryLevel,
      lat,
      lng,
    } = body;

    if (!fingerprint || !sessionId || !eventType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const userAgent = request.headers.get("user-agent") ?? "";

    await db.insert(events).values({
      deviceFingerprint: fingerprint,
      sessionId,
      eventType,
      eventData: eventData ?? {},
      page: page ?? null,
      referrer: referrer ?? null,
      ip,
      userAgent,
      screenWidth: screenWidth ? parseInt(screenWidth) : null,
      screenHeight: screenHeight ? parseInt(screenHeight) : null,
      language: language ?? null,
      timezone: timezone ?? null,
      connectionType: connectionType ?? null,
      batteryLevel: batteryLevel ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
