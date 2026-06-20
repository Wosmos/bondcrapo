import { and, between, eq, inArray } from "drizzle-orm";
import { draws, drawSources, type Db } from "@bondcheck/db";
import type { JobContext } from "../job";
import { commitDraw } from "./commit";
import { addDays } from "./dates";
import { candidatesFromDocument, documentsBySha, documentsByUrl, listingIndex, fetchOfficialSpot, storeDocument, type DocumentContext } from "./documents";
import type { FormPoster } from "./form-post";
import { parseOfficialDateList } from "./parse-html";
import { CLUSTER_WINDOW_DAYS, clusterCandidates, decideDraw, type Cluster, type DrawDecision } from "./reconcile";
import { OFFICIAL_LEGACY_IDS, OFFICIAL_PAGES, officialDateListUrl } from "./sources";
import type { Candidate } from "./types";

export interface CommitStats {
  drawsCreated: number;
  drawsChanged: number;
  drawsUnchanged: number;
  resultsReplaced: number;
  disputed: number;
  verified: number;
  spotChecks: number;
  rejectedClusters: number;
  /** Draws whose rows changed, for cache revalidation and wallet matching. */
  committed: { drawId: number; denominationCode: string; drawDate: string; completeness: string }[];
}

export const emptyCommitStats = (): CommitStats => ({
  drawsCreated: 0,
  drawsChanged: 0,
  drawsUnchanged: 0,
  resultsReplaced: 0,
  disputed: 0,
  verified: 0,
  spotChecks: 0,
  rejectedClusters: 0,
  committed: [],
});

/** Listing context from the stored official denomination pages (latest copy of each). */
export async function loadDocumentContext(db: Db): Promise<DocumentContext> {
  const pages = await documentsByUrl(db, Object.values(OFFICIAL_PAGES));
  return { listing: listingIndex([...pages.values()]) };
}

export interface SpotOptions {
  poster: FormPoster;
  /** Remaining official number searches allowed in this run (each is one POST). */
  budget: { remaining: number };
}

/** The legacy search `state` id of a draw date, from the stored official date list. */
async function spotStateId(db: Db, d: DrawDecision): Promise<number | null> {
  const docs = await documentsByUrl(db, [officialDateListUrl(d.denominationCode)]);
  const doc = docs.values().next().value;
  if (!doc) return null;
  return parseOfficialDateList(doc.body).find((e) => e.drawDate === d.drawDate)?.stateId ?? null;
}

/**
 * When valid sources disagree on the first prize, ask the official number search about each
 * disputed number (one POST per number, within budget) and decide again with the answers.
 */
async function resolveWithSpotChecks(
  ctx: JobContext,
  cluster: Cluster,
  decision: DrawDecision,
  spot: SpotOptions,
  today: string,
  stats: CommitStats,
): Promise<DrawDecision> {
  if (decision.status !== "disputed" || spot.budget.remaining <= 0) return decision;
  const stateId = await spotStateId(ctx.db, decision);
  if (stateId === null) return decision;
  const firsts = new Set<number>();
  for (const c of cluster.candidates) for (const n of c.tiers[1] ?? []) firsts.add(n);
  const asked = new Set(cluster.candidates.flatMap((c) => (c.spot ?? []).map((s) => s.number)));
  const extra: Candidate[] = [];
  const docContext = await loadDocumentContext(ctx.db);
  for (const n of [...firsts].filter((x) => !asked.has(x)).slice(0, 3)) {
    if (spot.budget.remaining <= 0) break;
    spot.budget.remaining--;
    stats.spotChecks++;
    const doc = await fetchOfficialSpot(spot.poster, OFFICIAL_LEGACY_IDS[decision.denominationCode], stateId, decision.drawDate, String(n).padStart(6, "0"));
    await storeDocument(ctx.db, doc);
    extra.push(...candidatesFromDocument(doc, docContext));
  }
  return extra.length ? decideDraw([...cluster.candidates, ...extra], today) : decision;
}

/** Decides and commits every cluster from `start`, stopping early when the time budget is spent. */
export async function commitClusters(
  ctx: JobContext,
  clusters: Cluster[],
  start: number,
  today: string,
  stats: CommitStats,
  opts: { from?: string; spot?: SpotOptions } = {},
): Promise<number> {
  let i = start;
  for (; i < clusters.length; i++) {
    if (i > start && ctx.shouldStop()) break;
    const cluster = clusters[i]!;
    let decision = await decideDraw(cluster.candidates, today);
    if (opts.from && decision.drawDate < opts.from) continue;
    if (opts.spot) decision = await resolveWithSpotChecks(ctx, cluster, decision, opts.spot, today, stats);
    const outcome = await commitDraw(ctx.db, decision, ctx.now());
    if (outcome.created) stats.drawsCreated++;
    else if (outcome.changed) stats.drawsChanged++;
    else stats.drawsUnchanged++;
    if (outcome.resultsReplaced && decision.results.length) stats.resultsReplaced++;
    if (decision.status === "disputed") stats.disputed++;
    if (decision.status === "verified") stats.verified++;
    if (outcome.changed) {
      stats.committed.push({
        drawId: outcome.drawId,
        denominationCode: decision.denominationCode,
        drawDate: decision.drawDate,
        completeness: decision.completeness,
      });
      // Issues are recorded only when the draw changed, so repeated runs stay quiet.
      for (const issue of [...decision.issues, ...outcome.issues]) {
        await ctx.issue({
          severity: issue.severity,
          entity: "draw",
          entityKey: `${decision.denominationCode}:${decision.drawDate}`,
          message: issue.message,
          details: issue.details,
        });
      }
    }
  }
  return i;
}

/** Candidates from the documents already linked to stored draws near the given candidates. */
export async function existingCandidates(db: Db, fresh: Candidate[], docContext: DocumentContext): Promise<Candidate[]> {
  const shas = new Set<string>();
  const byDenom = new Map<string, string[]>();
  for (const c of fresh) if (c.drawDate) byDenom.set(c.denominationCode, [...(byDenom.get(c.denominationCode) ?? []), c.drawDate]);
  for (const [code, dates] of byDenom) {
    const sorted = dates.sort();
    const rows = await db
      .select({ id: draws.id })
      .from(draws)
      .where(
        and(
          eq(draws.denominationCode, code),
          between(draws.drawDate, addDays(sorted[0]!, -CLUSTER_WINDOW_DAYS), addDays(sorted[sorted.length - 1]!, CLUSTER_WINDOW_DAYS)),
        ),
      );
    if (!rows.length) continue;
    const links = await db
      .select({ sha: drawSources.documentSha256 })
      .from(drawSources)
      .where(inArray(drawSources.drawId, rows.map((r) => r.id)));
    for (const l of links) shas.add(l.sha);
  }
  const known = new Set(fresh.map((c) => c.documentSha256));
  const docs = await documentsBySha(db, [...shas].filter((s) => !known.has(s)));
  const fromDocs = docs.flatMap((d) => candidatesFromDocument(d, docContext));
  // Only the rows of shared documents (record pages, date lists) that concern these draws.
  return fromDocs.filter((c) => c.drawDate && fresh.some((f) => f.denominationCode === c.denominationCode && f.drawDate && Math.abs(Date.parse(f.drawDate) - Date.parse(c.drawDate!)) <= CLUSTER_WINDOW_DAYS * 86_400_000));
}

/** Reconciles new candidates together with what is already stored for the same draws. */
export async function reconcileWithExisting(
  ctx: JobContext,
  fresh: Candidate[],
  today: string,
  stats: CommitStats,
  opts: { spot?: SpotOptions } = {},
): Promise<void> {
  if (!fresh.length) return;
  const docContext = await loadDocumentContext(ctx.db);
  const all = [...fresh, ...(await existingCandidates(ctx.db, fresh, docContext))];
  const { clusters, rejected } = clusterCandidates(all);
  stats.rejectedClusters += rejected.length;
  const relevant = clusters.filter((cl) => cl.candidates.some((c) => fresh.includes(c)));
  await commitClusters({ ...ctx, shouldStop: () => false }, relevant, 0, today, stats, opts);
}
