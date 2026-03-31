import { NextRequest, NextResponse } from "next/server";
import { scrapeOne, getAllScrapeTargets } from "@/lib/scraper-logic";

export const maxDuration = 60; // Vercel free tier max

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

  for (const target of targets) {
    // Stop if approaching timeout (leave 5s buffer)
    if (Date.now() - startTime > 50_000) {
      results.push({ note: "Stopped early to avoid timeout" });
      break;
    }

    try {
      const result = await scrapeOne(target.source, target.denomination);
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

  return NextResponse.json({
    success: true,
    duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    results,
  });
}
