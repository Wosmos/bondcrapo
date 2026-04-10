import { NextRequest, NextResponse } from "next/server";
import { fetchSavingsRates } from "@/lib/scrapers/savings-rates";
import {
  seedDrawSchedule,
  updateScheduleStatus,
} from "@/lib/scrapers/draw-schedule";

/**
 * Cron: Daily data refresh for savings rates, draw schedule, etc.
 * Schedule: Once daily at 12:00 UTC (configured in vercel.json)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: Record<string, { inserted: number; errors: string[] }> = {};

  // Run all daily data tasks in parallel
  const [savings, schedule] = await Promise.allSettled([
    fetchSavingsRates(),
    seedDrawSchedule(),
  ]);

  results.savings_rates =
    savings.status === "fulfilled"
      ? savings.value
      : { inserted: 0, errors: [String(savings.reason)] };

  results.draw_schedule =
    schedule.status === "fulfilled"
      ? schedule.value
      : { inserted: 0, errors: [String(schedule.reason)] };

  // Update schedule status (mark past draws as completed)
  try {
    await updateScheduleStatus();
  } catch (err) {
    results.schedule_status_update = {
      inserted: 0,
      errors: [String(err)],
    };
  }

  const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
  const totalErrors = Object.values(results).flatMap((r) => r.errors);

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - startTime,
    total_inserted: totalInserted,
    total_errors: totalErrors.length,
    results,
  });
}
