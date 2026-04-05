import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { walletNotifications } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";

// GET — fetch unseen + recent notifications for a device
export async function GET(request: NextRequest) {
  const rl = rateLimit(request, 10, 5, "notifications");
  if (!rl.success) return rl.response!;

  const fp = request.nextUrl.searchParams.get("fp");
  if (!fp) {
    return NextResponse.json({ error: "Missing fingerprint" }, { status: 400 });
  }

  try {
    const notifs = await db
      .select()
      .from(walletNotifications)
      .where(eq(walletNotifications.deviceFingerprint, fp))
      .orderBy(desc(walletNotifications.createdAt))
      .limit(50);

    const unseen = notifs.filter((n) => n.seen === 0).length;

    return NextResponse.json({ notifications: notifs, unseen });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PATCH — mark notifications as seen
export async function PATCH(request: NextRequest) {
  const rl = rateLimit(request, 10, 5, "notifications");
  if (!rl.success) return rl.response!;

  try {
    const { fingerprint } = await request.json();
    if (!fingerprint) {
      return NextResponse.json({ error: "Missing fingerprint" }, { status: 400 });
    }

    await db
      .update(walletNotifications)
      .set({ seen: 1 })
      .where(
        and(
          eq(walletNotifications.deviceFingerprint, fingerprint),
          eq(walletNotifications.seen, 0)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
