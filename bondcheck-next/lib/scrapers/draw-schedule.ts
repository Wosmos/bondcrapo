import { db } from "@/lib/db";
import { drawSchedule } from "@/lib/schema";
import { eq, gte, lt, desc, asc } from "drizzle-orm";

// ── Prize Bond Draw Schedule ──────────────────────────────
// Draws happen quarterly per denomination.
// Source: savings.gov.pk + prizeinfo.net

// 2026 draw schedule (from savings.gov.pk/prize-bonds/)
// Format: [denomination, draw_date (YYYY-MM-DD), city, draw_number]
const SCHEDULE_2026: [number, string, string | null, number | null][] = [
  // Rs. 100
  [100, "2026-02-16", "Quetta", 47],
  [100, "2026-05-15", "Lahore", 48],
  [100, "2026-08-17", "Peshawar", 49],
  [100, "2026-11-16", "Karachi", 50],
  // Rs. 200
  [200, "2026-03-16", "Faisalabad", 101],
  [200, "2026-06-15", "Rawalpindi", 102],
  [200, "2026-09-15", "Multan", 103],
  [200, "2026-12-15", "Hyderabad", 104],
  // Rs. 750
  [750, "2026-01-15", "Lahore", 110],
  [750, "2026-04-15", "Peshawar", 111],
  [750, "2026-07-15", "Rawalpindi", 112],
  [750, "2026-10-15", "Muzaffarabad", 113],
  // Rs. 1500
  [1500, "2026-02-17", "Karachi", 109],
  [1500, "2026-05-15", "Quetta", 110],
  [1500, "2026-08-17", "Lahore", 111],
  [1500, "2026-11-16", "Faisalabad", 112],
  // Rs. 25000 Premium
  [25000, "2026-03-10", "Rawalpindi", 30],
  [25000, "2026-06-10", "Lahore", 31],
  [25000, "2026-09-10", "Karachi", 32],
  [25000, "2026-12-10", "Peshawar", 33],
  // Rs. 40000 Premium
  [40000, "2026-03-02", "Multan", 28],
  [40000, "2026-06-02", "Karachi", 29],
  [40000, "2026-09-01", "Lahore", 30],
  [40000, "2026-12-01", "Rawalpindi", 31],
  // Digital Prize Bonds (launched 2025, registered to CNIC)
  [500, "2026-01-20", null, 3],
  [500, "2026-04-20", null, 4],
  [500, "2026-07-20", null, 5],
  [500, "2026-10-20", null, 6],
  [1000, "2026-02-20", null, 3],
  [1000, "2026-05-20", null, 4],
  [1000, "2026-08-20", null, 5],
  [1000, "2026-11-20", null, 6],
  [5000, "2026-03-20", null, 3],
  [5000, "2026-06-20", null, 4],
  [5000, "2026-09-20", null, 5],
  [5000, "2026-12-20", null, 6],
  [10000, "2026-01-25", null, 3],
  [10000, "2026-04-25", null, 4],
  [10000, "2026-07-25", null, 5],
  [10000, "2026-10-25", null, 6],
];

/**
 * Seed the draw schedule table with known 2026 dates.
 * Skips duplicates via ON CONFLICT.
 */
export async function seedDrawSchedule(): Promise<{
  inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let inserted = 0;

  try {
    for (const [denomination, drawDate, city, drawNumber] of SCHEDULE_2026) {
      const today = new Date().toISOString().split("T")[0];
      const status = drawDate < today ? "completed" : "scheduled";

      await db
        .insert(drawSchedule)
        .values({
          denomination,
          drawNumber,
          drawDate,
          city,
          status,
          source: "savings_gov_pk",
        })
        .onConflictDoNothing();
      inserted++;
    }
  } catch (err) {
    errors.push(`Schedule seed failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { inserted, errors };
}

/**
 * Mark past draws as completed and check if results are available.
 */
export async function updateScheduleStatus(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await db
    .update(drawSchedule)
    .set({ status: "completed" })
    .where(
      lt(drawSchedule.drawDate, today)
    );
}

/**
 * Get upcoming draws (future dates).
 */
export async function getUpcomingDraws(limit: number = 10) {
  const today = new Date().toISOString().split("T")[0];

  const rows = await db
    .select()
    .from(drawSchedule)
    .where(gte(drawSchedule.drawDate, today))
    .orderBy(asc(drawSchedule.drawDate))
    .limit(limit);

  const now = new Date();
  return rows.map((r) => {
    const drawDate = new Date(r.drawDate + "T00:00:00");
    const diffMs = drawDate.getTime() - now.getTime();
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      denomination: r.denomination,
      draw_number: r.drawNumber,
      draw_date: r.drawDate,
      city: r.city,
      status: r.status,
      days_until: daysUntil,
    };
  });
}

/**
 * Get recent completed draws.
 */
export async function getRecentDraws(limit: number = 10) {
  const today = new Date().toISOString().split("T")[0];

  const rows = await db
    .select()
    .from(drawSchedule)
    .where(lt(drawSchedule.drawDate, today))
    .orderBy(desc(drawSchedule.drawDate))
    .limit(limit);

  return rows.map((r) => ({
    denomination: r.denomination,
    draw_number: r.drawNumber,
    draw_date: r.drawDate,
    city: r.city,
    status: r.status,
    days_until: null,
  }));
}

/**
 * Get the next upcoming draw (soonest).
 */
export async function getNextDraw() {
  const upcoming = await getUpcomingDraws(1);
  return upcoming.length > 0 ? upcoming[0] : null;
}

/**
 * Get next draw per denomination.
 */
export async function getNextDrawPerDenomination() {
  const upcoming = await getUpcomingDraws(50);

  const byDenom = new Map<number, typeof upcoming[0]>();
  for (const draw of upcoming) {
    if (!byDenom.has(draw.denomination)) {
      byDenom.set(draw.denomination, draw);
    }
  }

  return Array.from(byDenom.values()).sort((a, b) => a.days_until! - b.days_until!);
}
