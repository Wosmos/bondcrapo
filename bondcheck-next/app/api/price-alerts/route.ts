import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { priceAlerts } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { eq, and } from "drizzle-orm";

/**
 * GET: Fetch all active alerts for a device.
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 10, 5, "price-alerts");
  if (!rl.success) return rl.response!;

  const fp = request.nextUrl.searchParams.get("fp");
  if (!fp) {
    return NextResponse.json({ error: "fp (fingerprint) required" }, { status: 400 });
  }

  try {
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.deviceFingerprint, fp),
          eq(priceAlerts.triggered, false)
        )
      );

    return NextResponse.json({
      alerts: alerts.map((a) => ({
        id: a.id,
        alert_type: a.alertType,
        target_value: a.targetValue ? Number(a.targetValue) : null,
        params: a.params,
        triggered: a.triggered,
        created_at: a.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST: Create a new price alert.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(request, 5, 3, "price-alerts");
  if (!rl.success) return rl.response!;

  try {
    const body = await request.json();
    const { fp, alert_type, target_value, params } = body;

    if (!fp || !alert_type) {
      return NextResponse.json(
        { error: "fp and alert_type are required" },
        { status: 400 }
      );
    }

    const validTypes = [
      "gold_above",
      "gold_below",
      "usd_above",
      "usd_below",
      "btc_above",
      "btc_below",
      "draw_reminder",
    ];

    if (!validTypes.includes(alert_type)) {
      return NextResponse.json(
        { error: `Invalid alert_type. Use: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Limit alerts per device to 20
    const existing = await db
      .select()
      .from(priceAlerts)
      .where(
        and(
          eq(priceAlerts.deviceFingerprint, fp),
          eq(priceAlerts.triggered, false)
        )
      );

    if (existing.length >= 20) {
      return NextResponse.json(
        { error: "Maximum 20 active alerts per device" },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(priceAlerts)
      .values({
        deviceFingerprint: fp,
        alertType: alert_type,
        targetValue: target_value != null ? String(target_value) : null,
        params: params ?? null,
      })
      .returning({ id: priceAlerts.id });

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE: Remove a price alert.
 */
export async function DELETE(request: NextRequest) {
  const rl = rateLimit(request, 5, 3, "price-alerts");
  if (!rl.success) return rl.response!;

  try {
    const body = await request.json();
    const { fp, id } = body;

    if (!fp || !id) {
      return NextResponse.json(
        { error: "fp and id are required" },
        { status: 400 }
      );
    }

    await db
      .delete(priceAlerts)
      .where(
        and(
          eq(priceAlerts.id, id),
          eq(priceAlerts.deviceFingerprint, fp)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
