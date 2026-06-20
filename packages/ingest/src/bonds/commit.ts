import { and, asc, between, eq, ne } from "drizzle-orm";
import { drawPrizes, drawResults, draws, drawSources, type Db } from "@bondcheck/db";
import { addDays, daysBetween } from "./dates";
import { CLUSTER_WINDOW_DAYS, type Completeness, type DrawDecision } from "./reconcile";
import type { IssueInput } from "./types";

export interface CommitOutcome {
  drawId: number;
  created: boolean;
  /** False when the stored draw already matched the decision: nothing was written. */
  changed: boolean;
  resultsReplaced: boolean;
  issues: IssueInput[];
}

const RANK: Record<Completeness, number> = { none: 0, top: 1, full: 2 };
const INSERT_CHUNK = 1000;

/**
 * Runs `fn` in a transaction when the driver supports one (Neon WebSocket, PGlite). The Neon
 * HTTP driver has no interactive transactions; there the writes run in an order that is safe to
 * repeat: results first, the draw's checksum last, so an interrupted commit is redone next run.
 */
export async function withTx<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (tx) => fn(tx as unknown as Db));
  } catch (error) {
    if (error instanceof Error && /no transactions support|transactions are not supported/i.test(error.message)) return fn(db);
    throw error;
  }
}

type DrawRow = typeof draws.$inferSelect;

async function findExisting(db: Db, d: DrawDecision): Promise<DrawRow | undefined> {
  const near = await db
    .select()
    .from(draws)
    .where(
      and(
        eq(draws.denominationCode, d.denominationCode),
        between(draws.drawDate, addDays(d.drawDate, -CLUSTER_WINDOW_DAYS), addDays(d.drawDate, CLUSTER_WINDOW_DAYS)),
      ),
    )
    .orderBy(asc(draws.drawDate));
  return near.sort((a, b) => daysBetween(a.drawDate, d.drawDate) - daysBetween(b.drawDate, d.drawDate))[0];
}

function sameSources(a: { documentSha256: string; role: string; parserVersion: string; parsedCount: number; checksum: string | null }[], b: DrawDecision["sources"]): boolean {
  if (a.length !== b.length) return false;
  const key = (s: { documentSha256: string; role: string; parserVersion: string; parsedCount: number; checksum: string | null }) =>
    `${s.documentSha256}|${s.role}|${s.parserVersion}|${s.parsedCount}|${s.checksum ?? ""}`;
  const set = new Set(a.map(key));
  return b.every((s) => set.has(key(s)));
}

function samePrizes(a: { tier: number; amountPkr: number; winnersCount: number; inferred: number }[], b: DrawDecision["prizes"]): boolean {
  if (a.length !== b.length) return false;
  return b.every((p) =>
    a.some((x) => x.tier === p.tier && x.amountPkr === p.amountPkr && x.winnersCount === p.winnersCount && x.inferred === (p.inferred ? 1 : 0)),
  );
}

/**
 * Writes one reconciled draw. Idempotent: when the stored row, its sources and its prize table
 * already match, nothing is written. Results are replaced only when the checksum differs, a
 * verified list is never replaced automatically (the draw is marked disputed instead), and a
 * draw never loses completeness because a source went missing.
 */
export async function commitDraw(db: Db, d: DrawDecision, now: Date): Promise<CommitOutcome> {
  const issues: IssueInput[] = [];
  const existing = await findExisting(db, d);

  let status = d.status;
  let completeness = d.completeness;
  let checksum = d.checksum;
  let replaceResults = true;
  let prizes = d.prizes;
  if (existing) {
    const lostData = RANK[d.completeness] < RANK[existing.completeness as Completeness];
    const verifiedChanged =
      existing.status === "verified" && existing.resultChecksum !== null && d.checksum !== null && existing.resultChecksum !== d.checksum;
    if (lostData || verifiedChanged) {
      replaceResults = false;
      completeness = existing.completeness as Completeness;
      checksum = existing.resultChecksum;
      prizes = [];
      status = verifiedChanged ? "disputed" : (existing.status as DrawDecision["status"]);
      issues.push({
        severity: verifiedChanged ? "error" : "warn",
        message: verifiedChanged
          ? `verified results changed upstream (stored ${existing.resultChecksum}, new ${d.checksum}); kept the stored list and marked the draw disputed`
          : `new reconciliation has less data (${d.completeness}) than stored (${existing.completeness}); stored results kept`,
      });
    } else if (existing.resultChecksum === d.checksum) {
      replaceResults = false;
    }
  }

  // The draw number is unique per denomination; another row holding it means a data error.
  let drawNumber = d.drawNumber;
  if (drawNumber !== null) {
    const [holder] = await db
      .select({ id: draws.id, drawDate: draws.drawDate })
      .from(draws)
      .where(
        and(
          eq(draws.denominationCode, d.denominationCode),
          eq(draws.drawNumber, drawNumber),
          ...(existing ? [ne(draws.id, existing.id)] : []),
        ),
      );
    if (holder) {
      issues.push({ severity: "error", message: `draw number ${drawNumber} already belongs to the draw of ${holder.drawDate}; left empty here` });
      drawNumber = existing?.drawNumber ?? null;
    }
  }

  if (existing) {
    const [currentSources, currentPrizes] = await Promise.all([
      db.select().from(drawSources).where(eq(drawSources.drawId, existing.id)),
      db.select().from(drawPrizes).where(eq(drawPrizes.drawId, existing.id)),
    ]);
    const unchanged =
      !replaceResults &&
      existing.drawDate === d.drawDate &&
      existing.drawNumber === drawNumber &&
      existing.city === d.city &&
      existing.status === status &&
      existing.completeness === completeness &&
      existing.resultChecksum === checksum &&
      sameSources(currentSources, d.sources) &&
      (prizes.length === 0 && d.prizes.length > 0 ? true : samePrizes(currentPrizes, prizes));
    if (unchanged) return { drawId: existing.id, created: false, changed: false, resultsReplaced: false, issues };
  }

  return withTx(db, async (tx) => {
    let drawId: number;
    let created = false;
    const publishedAt = status === "scheduled" ? null : (existing?.publishedAt ?? now);
    const verifiedAt = status === "verified" ? (existing?.status === "verified" ? existing.verifiedAt : now) : null;
    if (existing) {
      drawId = existing.id;
      await tx
        .update(draws)
        .set({ drawDate: d.drawDate, drawNumber, city: d.city, status, completeness, publishedAt, verifiedAt, updatedAt: now })
        .where(eq(draws.id, drawId));
    } else {
      const [row] = await tx
        .insert(draws)
        .values({
          denominationCode: d.denominationCode,
          drawDate: d.drawDate,
          drawNumber,
          city: d.city,
          status,
          completeness,
          resultChecksum: null,
          publishedAt,
          verifiedAt,
          updatedAt: now,
        })
        .returning({ id: draws.id });
      drawId = row!.id;
      created = true;
    }

    if (replaceResults) {
      await tx.delete(drawResults).where(eq(drawResults.drawId, drawId));
      for (let i = 0; i < d.results.length; i += INSERT_CHUNK) {
        await tx.insert(drawResults).values(d.results.slice(i, i + INSERT_CHUNK).map((r) => ({ drawId, bondNumber: r.bondNumber, tier: r.tier })));
      }
    }
    if (replaceResults || prizes.length) {
      await tx.delete(drawPrizes).where(eq(drawPrizes.drawId, drawId));
      if (prizes.length) {
        await tx.insert(drawPrizes).values(prizes.map((p) => ({ drawId, tier: p.tier, amountPkr: p.amountPkr, winnersCount: p.winnersCount, inferred: p.inferred ? 1 : 0 })));
      }
    }
    await tx.delete(drawSources).where(eq(drawSources.drawId, drawId));
    if (d.sources.length) await tx.insert(drawSources).values(d.sources.map((s) => ({ drawId, ...s })));
    // Checksum last: if anything above failed without a transaction, the next run sees a stale
    // checksum and redoes the commit.
    await tx.update(draws).set({ resultChecksum: checksum }).where(eq(draws.id, drawId));
    return { drawId, created, changed: true, resultsReplaced: replaceResults, issues };
  });
}
