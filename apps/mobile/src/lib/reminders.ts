import type { z } from "zod";
import type { scheduleEntrySchema } from "@bondcheck/shared";

type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

export interface PlannedReminder {
  id: string;
  fireAt: Date;
  denominationCode: string;
  drawDate: string;
  city: string | null;
}

export const REMINDER_PREFIX = "draw-";
/** Android keeps scheduled alarms per app; a small horizon keeps the list fresh and cheap. */
export const MAX_REMINDERS = 12;
export const REMINDER_HOUR = 9;

/**
 * Reminders at 09:00 local time on the day of each upcoming draw of a denomination the person
 * owns. Past draws, unknown dates and duplicates are skipped; the earliest come first.
 */
export function planDrawReminders(
  entries: readonly ScheduleEntry[],
  owned: ReadonlySet<string>,
  now: Date = new Date(),
  limit = MAX_REMINDERS,
): PlannedReminder[] {
  const seen = new Set<string>();
  const out: PlannedReminder[] = [];
  for (const e of entries) {
    if (!owned.has(e.denominationCode) || e.status !== "scheduled") continue;
    const [y, m, d] = e.drawDate.split("-").map(Number);
    if (!y || !m || !d) continue;
    const fireAt = new Date(y, m - 1, d, REMINDER_HOUR, 0, 0, 0);
    if (fireAt.getTime() <= now.getTime()) continue;
    const id = `${REMINDER_PREFIX}${e.denominationCode}-${e.drawDate}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, fireAt, denominationCode: e.denominationCode, drawDate: e.drawDate, city: e.city });
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, limit);
}

export interface MatchLike {
  drawId: number;
  bondNumber: string;
  seenAt: string | null;
}

export const matchKey = (m: { drawId: number; bondNumber: string }) => `${m.drawId}:${m.bondNumber}`;

/** Unseen wins that have not produced a local notification on this phone yet. */
export function selectNewWins<M extends MatchLike>(matches: readonly M[], notified: ReadonlySet<string>): M[] {
  return matches.filter((m) => m.seenAt === null && !notified.has(matchKey(m)));
}
