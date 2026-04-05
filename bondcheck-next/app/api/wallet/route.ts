import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { walletBonds, winners } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

// GET — fetch all saved bonds for a device
export async function GET(request: NextRequest) {
  const fingerprint = request.nextUrl.searchParams.get("fp");
  if (!fingerprint) {
    return NextResponse.json({ error: "Missing fingerprint" }, { status: 400 });
  }

  try {
    const bonds = await db
      .select()
      .from(walletBonds)
      .where(eq(walletBonds.deviceFingerprint, fingerprint))
      .orderBy(walletBonds.addedAt);

    return NextResponse.json({ bonds });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST — add bond(s) to wallet
export async function POST(request: NextRequest) {
  try {
    const { fingerprint, bondNumber, label, denomination } = await request.json();

    if (!fingerprint || !bondNumber) {
      return NextResponse.json({ error: "Missing fingerprint or bondNumber" }, { status: 400 });
    }

    // Normalize: accept single or array
    const bondNumbers = Array.isArray(bondNumber) ? bondNumber : [bondNumber];
    const inserted: string[] = [];

    for (const bn of bondNumbers.slice(0, 100)) {
      const cleaned = bn.toString().trim();
      if (!/^\d{6}$/.test(cleaned)) continue;

      try {
        await db.insert(walletBonds).values({
          deviceFingerprint: fingerprint,
          bondNumber: cleaned,
          label: label ?? null,
          denomination: denomination ?? null,
        }).onConflictDoNothing();
        inserted.push(cleaned);
      } catch { /* duplicate — skip */ }
    }

    return NextResponse.json({ ok: true, added: inserted.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE — remove bond from wallet
export async function DELETE(request: NextRequest) {
  try {
    const { fingerprint, bondNumber } = await request.json();

    if (!fingerprint || !bondNumber) {
      return NextResponse.json({ error: "Missing fingerprint or bondNumber" }, { status: 400 });
    }

    await db
      .delete(walletBonds)
      .where(
        and(
          eq(walletBonds.deviceFingerprint, fingerprint),
          eq(walletBonds.bondNumber, bondNumber)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PATCH — check all wallet bonds against winners (the magic!)
export async function PATCH(request: NextRequest) {
  try {
    const { fingerprint } = await request.json();

    if (!fingerprint) {
      return NextResponse.json({ error: "Missing fingerprint" }, { status: 400 });
    }

    // Get all saved bonds
    const savedBonds = await db
      .select({ bondNumber: walletBonds.bondNumber })
      .from(walletBonds)
      .where(eq(walletBonds.deviceFingerprint, fingerprint));

    if (!savedBonds.length) {
      return NextResponse.json({ results: {}, checked: 0, winners: 0 });
    }

    const bondNumbers = savedBonds.map((b) => b.bondNumber);

    // Check against winners table
    const wins = await db
      .select({
        id: winners.id,
        bond_number: winners.bondNumber,
        denomination: winners.denomination,
        draw_number: winners.drawNumber,
        draw_date: winners.drawDate,
        city: winners.city,
        prize_position: winners.prizePosition,
        prize_amount: winners.prizeAmount,
        source: winners.source,
      })
      .from(winners)
      .where(inArray(winners.bondNumber, bondNumbers));

    // Group by bond number
    const results: Record<string, typeof wins> = {};
    for (const win of wins) {
      if (!results[win.bond_number]) results[win.bond_number] = [];
      results[win.bond_number].push(win);
    }

    const winnerCount = Object.keys(results).length;

    return NextResponse.json({
      results,
      checked: bondNumbers.length,
      winners: winnerCount,
      totalPrizes: wins.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
