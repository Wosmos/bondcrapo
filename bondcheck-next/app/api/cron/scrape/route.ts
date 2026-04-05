import { NextRequest, NextResponse } from "next/server";
import { scrapeOne, getAllScrapeTargets } from "@/lib/scraper-logic";
import { db } from "@/lib/db";
import { walletBonds, winners, walletNotifications } from "@/lib/schema";
import { inArray, and, gte, eq } from "drizzle-orm";

export const maxDuration = 60; // Vercel free tier max

/** After scraping, check all wallet bonds against newly inserted winners */
async function autoCheckWalletBonds(scrapeStartTime: Date) {
  // Get all unique bond numbers saved in wallets
  const allWalletBonds = await db
    .select({
      deviceFingerprint: walletBonds.deviceFingerprint,
      bondNumber: walletBonds.bondNumber,
    })
    .from(walletBonds);

  if (!allWalletBonds.length) return { checked: 0, notified: 0 };

  const uniqueBondNumbers = [...new Set(allWalletBonds.map((b) => b.bondNumber))];

  // Find winners that were inserted during this scrape run
  const newWins = await db
    .select({
      id: winners.id,
      bondNumber: winners.bondNumber,
      denomination: winners.denomination,
      prizePosition: winners.prizePosition,
      prizeAmount: winners.prizeAmount,
      drawDate: winners.drawDate,
    })
    .from(winners)
    .where(
      and(
        inArray(winners.bondNumber, uniqueBondNumbers),
        gte(winners.createdAt, scrapeStartTime)
      )
    );

  if (!newWins.length) return { checked: uniqueBondNumbers.length, notified: 0 };

  // Build a lookup: bondNumber -> [deviceFingerprints]
  const bondToDevices = new Map<string, string[]>();
  for (const wb of allWalletBonds) {
    const arr = bondToDevices.get(wb.bondNumber) || [];
    arr.push(wb.deviceFingerprint);
    bondToDevices.set(wb.bondNumber, arr);
  }

  // Insert notifications for each device that holds a winning bond
  let notified = 0;
  for (const win of newWins) {
    const devices = bondToDevices.get(win.bondNumber) || [];
    for (const fp of devices) {
      try {
        await db
          .insert(walletNotifications)
          .values({
            deviceFingerprint: fp,
            bondNumber: win.bondNumber,
            winnerId: win.id,
            denomination: win.denomination,
            prizePosition: win.prizePosition,
            prizeAmount: win.prizeAmount,
            drawDate: win.drawDate,
          })
          .onConflictDoNothing();
        notified++;
      } catch { /* duplicate — skip */ }
    }
  }

  return { checked: uniqueBondNumbers.length, notified };
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = [];
  const targets = getAllScrapeTargets();
  const startTime = Date.now();
  const scrapeStartTime = new Date();
  let totalInserted = 0;

  for (const target of targets) {
    // Stop if approaching timeout (leave 10s buffer for wallet check)
    if (Date.now() - startTime > 45_000) {
      results.push({ note: "Stopped early to avoid timeout" });
      break;
    }

    try {
      const result = await scrapeOne(target.source, target.denomination);
      totalInserted += result.inserted;
      // Only include targets that found new data
      if (result.inserted > 0 || result.errors.length > 0) {
        results.push(result);
      }
    } catch (err) {
      results.push({
        source: target.source,
        denomination: target.denomination,
        error: String(err),
      });
    }
  }

  // Auto-check wallet bonds if new data was inserted
  let walletCheck = null;
  if (totalInserted > 0) {
    try {
      walletCheck = await autoCheckWalletBonds(scrapeStartTime);
    } catch (err) {
      walletCheck = { error: String(err) };
    }
  }

  return NextResponse.json({
    success: true,
    duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    totalInserted,
    walletCheck,
    results,
  });
}
