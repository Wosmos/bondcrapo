import { and, asc, between, eq, inArray, ne } from "drizzle-orm";
import { draws } from "@bondcheck/db";
import type { DenominationCode } from "@bondcheck/shared";
import type { Job, JobContext } from "../job";
import { addDays, daysBetween, pktDate } from "./dates";
import { candidatesFromDocument, documentsByUrl, fetchDocument, fetchOfficialDateList, listingIndex, storeDocument } from "./documents";
import { emptyCommitStats, reconcileWithExisting, type CommitStats } from "./engine";
import { FormPoster } from "./form-post";
import { OFFICIAL_LEGACY_IDS, OFFICIAL_PAGES, prizeinfoScheduleUrl } from "./sources";
import type { Candidate } from "./types";

export interface BondJobDeps {
  /** POST client for the official date lists (schedule job). Created with the job's User-Agent when absent. */
  poster?: (ctx: JobContext) => FormPoster;
}

/** Denominations with an official results page: the ones that still hold draws. */
const SYNCED = Object.keys(OFFICIAL_PAGES) as DenominationCode[];

/**
 * Fetches the official page of a denomination, stores it and every new result file linked for a
 * draw within the window, and returns the candidates those files yield.
 */
async function officialCandidates(ctx: JobContext, code: DenominationCode, dates: string[], refetchKnown = false): Promise<{ candidates: Candidate[]; fetched: number }> {
  const pageUrl = OFFICIAL_PAGES[code]!;
  const page = await fetchDocument(ctx.fetcher, pageUrl, "savings_gov_pk");
  await storeDocument(ctx.db, page);
  const listing = listingIndex([page]);
  const links = [...listing.values()].filter((l) => l.format !== "doc" && l.drawDate && dates.some((d) => daysBetween(d, l.drawDate!) <= 10));
  const txtDates = new Set(links.filter((l) => l.format === "txt").map((l) => l.drawDate));
  const wanted = links.filter((l) => l.format === "txt" || !txtDates.has(l.drawDate));
  const stored = await documentsByUrl(ctx.db, wanted.map((l) => l.url));
  const candidates: Candidate[] = [];
  let fetched = 0;
  for (const link of wanted) {
    let doc = stored.get(link.url);
    if (!doc || refetchKnown) {
      doc = await fetchDocument(ctx.fetcher, link.url, "savings_gov_pk");
      fetched++;
      await storeDocument(ctx.db, doc);
    }
    candidates.push(...candidatesFromDocument(doc, { listing }));
  }
  return { candidates, fetched };
}

function summary(stats: CommitStats, extra: Record<string, unknown> = {}) {
  return { ...stats, ...extra };
}

export function createBondJobs(deps: BondJobDeps = {}): Job[] {
  const posterFor = (ctx: JobContext) => deps.poster?.(ctx) ?? new FormPoster({ userAgent: ctx.fetcher.userAgent });

  /**
   * bonds-sync: on a draw day (a stored draw dated today or in the last three days that is not
   * complete yet) fetch the official page and new result files, reconcile and commit. Every other
   * day it is a no-op that touches no external site.
   */
  const sync: Job = {
    name: "bonds-sync",
    async run(ctx) {
      const today = pktDate(ctx.now());
      const due = await ctx.db
        .select({ denominationCode: draws.denominationCode, drawDate: draws.drawDate })
        .from(draws)
        .where(and(between(draws.drawDate, addDays(today, -3), today), ne(draws.completeness, "full"), inArray(draws.denominationCode, SYNCED)))
        .orderBy(asc(draws.drawDate));
      if (!due.length) return { done: true, cursor: null, stats: { noop: true, reason: "no draw due", today } };
      const stats = emptyCommitStats();
      let fetched = 0;
      const byCode = new Map<DenominationCode, string[]>();
      for (const d of due) byCode.set(d.denominationCode as DenominationCode, [...(byCode.get(d.denominationCode as DenominationCode) ?? []), d.drawDate]);
      for (const [code, dates] of byCode) {
        const r = await officialCandidates(ctx, code, dates);
        fetched += r.fetched;
        await reconcileWithExisting(ctx, r.candidates, today, stats);
      }
      return { done: true, cursor: null, stats: summary(stats, { due: due.length, filesFetched: fetched, today }) };
    },
  };

  /**
   * bonds-verify: re-fetch the official files of draws from the last 120 days and reconcile again.
   * A changed upstream file changes the checksum; verified lists are never overwritten silently.
   */
  const verify: Job = {
    name: "bonds-verify",
    async run(ctx, cursor) {
      const today = pktDate(ctx.now());
      const start = typeof cursor === "number" ? cursor : 0;
      const recent = await ctx.db
        .select({ denominationCode: draws.denominationCode, drawDate: draws.drawDate })
        .from(draws)
        .where(and(between(draws.drawDate, addDays(today, -120), today), inArray(draws.denominationCode, SYNCED), ne(draws.status, "scheduled")))
        .orderBy(asc(draws.denominationCode), asc(draws.drawDate));
      const codes = [...new Set(recent.map((r) => r.denominationCode as DenominationCode))];
      const stats = emptyCommitStats();
      let i = start;
      for (; i < codes.length; i++) {
        if (i > start && ctx.shouldStop()) break;
        const code = codes[i]!;
        const r = await officialCandidates(ctx, code, recent.filter((x) => x.denominationCode === code).map((x) => x.drawDate), true);
        await reconcileWithExisting(ctx, r.candidates, today, stats);
      }
      const done = i >= codes.length;
      return { done, cursor: done ? null : i, stats: summary(stats, { denominations: codes.length, today }) };
    },
  };

  /**
   * bonds-schedule: refresh the draw calendar from the official date lists (one POST per active
   * denomination) and the prizeinfo.net schedule for this year (and next year from November).
   * Unknown future draws become `scheduled` rows; known ones gain their draw number and city.
   */
  const schedule: Job = {
    name: "bonds-schedule",
    async run(ctx) {
      const today = pktDate(ctx.now());
      const year = Number(today.slice(0, 4));
      const poster = posterFor(ctx);
      const docs = [];
      for (const code of SYNCED) docs.push(await fetchOfficialDateList(poster, code, OFFICIAL_LEGACY_IDS[code]));
      for (const y of Number(today.slice(5, 7)) >= 11 ? [year, year + 1] : [year]) {
        try {
          docs.push(await fetchDocument(ctx.fetcher, prizeinfoScheduleUrl(y), "prizeinfo_net"));
        } catch (error) {
          // Next year's page appears late in the year; the official lists still apply.
          await ctx.issue({ severity: "info", entity: "document", entityKey: prizeinfoScheduleUrl(y), message: String(error) });
        }
      }
      for (const d of docs) await storeDocument(ctx.db, d);
      const fresh = docs
        .flatMap((d) => candidatesFromDocument(d, { listing: new Map() }))
        .filter((c) => c.drawDate && c.drawDate >= addDays(today, -400) && SYNCED.includes(c.denominationCode));
      const stats = emptyCommitStats();
      await reconcileWithExisting(ctx, fresh, today, stats);
      const upcoming = await ctx.db
        .select({ id: draws.id })
        .from(draws)
        .where(and(eq(draws.status, "scheduled"), between(draws.drawDate, today, addDays(today, 400))));
      return { done: true, cursor: null, stats: summary(stats, { upcoming: upcoming.length, today }) };
    },
  };

  return [sync, verify, schedule];
}

/** Registered by the CLI and by the web cron dispatcher (apps/web/src/features/bonds/jobs.ts). */
export const bondJobs: Job[] = createBondJobs();
