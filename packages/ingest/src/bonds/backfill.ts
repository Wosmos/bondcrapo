import type { Db } from "@bondcheck/db";
import { DENOMINATION_CODES, type DenominationCode } from "@bondcheck/shared";
import type { Job, JobContext } from "../job";
import { pktDate } from "./dates";
import {
  candidatesFromDocument,
  documentsBySource,
  documentsByUrl,
  fetchDocument,
  fetchOfficialDateList,
  listingIndex,
  storeDocument,
  type StoredDocument,
} from "./documents";
import { commitClusters, emptyCommitStats, type CommitStats } from "./engine";
import type { FormPoster } from "./form-post";
import {
  buildLegacyDrafts,
  findLegacyArtefacts,
  legacyDocumentBody,
  legacyDocumentUrl,
  legacyGroups,
  legacyTableName,
  readLegacyRows,
} from "./legacy";
import { clusterCandidates, type Cluster } from "./reconcile";
import { seedBondReference } from "./seed";
import { OFFICIAL_LEGACY_IDS, OFFICIAL_PAGES, prizeinfoRecordUrl, prizeinfoScheduleUrl } from "./sources";
import { sha256Hex } from "../fetcher";

export interface BackfillOptions {
  /** Only draws on or after this date (YYYY-MM-DD). */
  from?: string;
  denominations?: DenominationCode[];
  /** Fetch from the official site and prizeinfo.net (default true). */
  network?: boolean;
  /** Import the legacy snapshot table (default true when it exists). */
  legacy?: boolean;
  /** Database to read the legacy snapshot from (default: the job database). Read only. */
  legacyDb?: Db;
  /** POST client for the official legacy search (date lists and number search). */
  poster?: FormPoster;
  /** Maximum official number searches in one backfill (default 40). */
  spotBudget?: number;
  /** prizeinfo.net schedule years to read (default 2020 to the current year; the site starts at 2020). */
  scheduleYears?: number[];
}

type Phase = "seed" | "catalog" | "pages" | "files" | "prizeinfo" | "legacy" | "reconcile" | "done";
const PHASES: Phase[] = ["seed", "catalog", "pages", "files", "prizeinfo", "legacy", "reconcile", "done"];

interface Cursor {
  phase: Phase;
  i: number;
  spotRemaining?: number;
  artefacts?: Record<string, number[]>;
}

export interface BackfillStats extends Omit<CommitStats, "committed"> {
  seeded: number;
  documentsFetched: number;
  documentsNew: number;
  legacyDrafts: number;
  fetchErrors: number;
  /** Everything that changed in the database during this chunk. Zero on a repeated run. */
  changes: number;
  committedDraws: number;
}

/** Cache of the reconcile phase inputs while one process works through the chunks. */
let clusterCache: { key: string; clusters: Cluster[]; rejected: number } | null = null;

export function createBackfillJob(options: BackfillOptions = {}): Job {
  const codes = options.denominations?.length ? options.denominations : [...DENOMINATION_CODES];
  const keep = (code: string, date: string | null) =>
    (codes as string[]).includes(code) && (!options.from || date === null || date >= options.from);

  return {
    name: "bonds-backfill",
    async run(ctx: JobContext, rawCursor: unknown) {
      const cursor: Cursor = isCursor(rawCursor) ? rawCursor : { phase: "seed", i: 0 };
      const today = pktDate(ctx.now());
      const stats: BackfillStats = {
        ...emptyCommitStats(),
        seeded: 0,
        documentsFetched: 0,
        documentsNew: 0,
        legacyDrafts: 0,
        fetchErrors: 0,
        changes: 0,
        committedDraws: 0,
      };
      const commit: CommitStats = emptyCommitStats();
      const network = options.network !== false;

      const store = async (doc: StoredDocument) => {
        stats.documentsFetched++;
        if (await storeDocument(ctx.db, doc)) stats.documentsNew++;
      };
      const tryFetch = async (label: string, fn: () => Promise<StoredDocument>) => {
        try {
          await store(await fn());
        } catch (error) {
          stats.fetchErrors++;
          await ctx.issue({
            severity: "warn",
            entity: "document",
            entityKey: label,
            message: `fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      };

      while (cursor.phase !== "done") {
        if (ctx.shouldStop()) return finish(false);
        switch (cursor.phase) {
          case "seed": {
            stats.seeded = await seedBondReference(ctx.db);
            next("catalog");
            break;
          }
          case "catalog": {
            if (!network || !options.poster) {
              next("pages");
              break;
            }
            const lists = codes.map((c) => ({ kind: "list" as const, code: c }));
            const years = options.scheduleYears ?? range(Math.max(2020, Number((options.from ?? "2020").slice(0, 4))), Number(today.slice(0, 4)));
            const work = [...lists, ...years.map((y) => ({ kind: "schedule" as const, year: y }))];
            for (; cursor.i < work.length; cursor.i++) {
              if (ctx.shouldStop()) return finish(false);
              const w = work[cursor.i]!;
              if (w.kind === "list") await tryFetch(`date-list:${w.code}`, () => fetchOfficialDateList(options.poster!, w.code, OFFICIAL_LEGACY_IDS[w.code]));
              else await tryFetch(`schedule:${w.year}`, () => fetchDocument(ctx.fetcher, prizeinfoScheduleUrl(w.year), "prizeinfo_net"));
            }
            next("pages");
            break;
          }
          case "pages": {
            const pages = network ? codes.map((c) => OFFICIAL_PAGES[c]).filter((u): u is string => Boolean(u)) : [];
            for (; cursor.i < pages.length; cursor.i++) {
              if (ctx.shouldStop()) return finish(false);
              await tryFetch(pages[cursor.i]!, () => fetchDocument(ctx.fetcher, pages[cursor.i]!, "savings_gov_pk"));
            }
            next("files");
            break;
          }
          case "files": {
            const todo = network ? await filesToFetch(ctx.db, keep) : [];
            // `todo` shrinks as files are stored, so the cursor index is not needed here.
            for (const url of todo) {
              if (ctx.shouldStop()) return finish(false);
              await tryFetch(url, () => fetchDocument(ctx.fetcher, url, "savings_gov_pk"));
            }
            next("prizeinfo");
            break;
          }
          case "prizeinfo": {
            const urls = network ? codes.map(prizeinfoRecordUrl) : [];
            for (; cursor.i < urls.length; cursor.i++) {
              if (ctx.shouldStop()) return finish(false);
              await tryFetch(urls[cursor.i]!, () => fetchDocument(ctx.fetcher, urls[cursor.i]!, "prizeinfo_net"));
            }
            next("legacy");
            break;
          }
          case "legacy": {
            const source = options.legacyDb ?? ctx.db;
            const table = options.legacy === false ? null : await legacyTableName(source);
            if (!table) {
              next("reconcile");
              break;
            }
            if (!cursor.artefacts) {
              const found = await findLegacyArtefacts(source, table);
              cursor.artefacts = Object.fromEntries([...found].map(([s, set]) => [s, [...set].sort((a, b) => a - b)]));
            }
            const artefacts = new Map(Object.entries(cursor.artefacts).map(([s, list]) => [s, new Set(list)]));
            const groups = (await legacyGroups(source, table)).filter((g) => codes.some((c) => Number.parseInt(c, 10) === g.denomination));
            for (; cursor.i < groups.length; cursor.i++) {
              if (cursor.i > 0 && ctx.shouldStop()) return finish(false);
              const g = groups[cursor.i]!;
              const drafts = buildLegacyDrafts(await readLegacyRows(source, table, g.source, g.denomination), artefacts);
              for (const d of drafts) {
                if (!keep(d.denominationCode, d.drawDate)) continue;
                const body = legacyDocumentBody(d);
                stats.legacyDrafts++;
                const doc: StoredDocument = {
                  sha256: await sha256Hex(body),
                  source: "legacy_db_snapshot",
                  url: legacyDocumentUrl(d),
                  fetchedAt: ctx.now(),
                  contentType: "text/plain",
                  bytes: body.length,
                  body,
                };
                if (await storeDocument(ctx.db, doc)) stats.documentsNew++;
              }
            }
            next("reconcile");
            break;
          }
          case "reconcile": {
            const key = JSON.stringify({ codes, from: options.from ?? null });
            if (!clusterCache || clusterCache.key !== key || cursor.i === 0) {
              clusterCache = { key, ...(await buildClusters(ctx.db, keep)) };
              commit.rejectedClusters = clusterCache.rejected;
            }
            const clusters = clusterCache.clusters;
            const budget = { remaining: cursor.spotRemaining ?? options.spotBudget ?? 40 };
            const next_ = await commitClusters(ctx, clusters, cursor.i, today, commit, {
              from: options.from,
              spot: network && options.poster ? { poster: options.poster, budget } : undefined,
            });
            cursor.spotRemaining = budget.remaining;
            cursor.i = next_;
            if (cursor.i < clusters.length) return finish(false);
            clusterCache = null;
            next("done");
            break;
          }
        }
      }
      return finish(true);

      function next(phase: Phase) {
        cursor.phase = phase;
        cursor.i = 0;
      }

      function finish(done: boolean) {
        const { committed, ...rest } = commit;
        Object.assign(stats, rest);
        stats.committedDraws = committed.length;
        stats.changes = stats.seeded + stats.documentsNew + commit.drawsCreated + commit.drawsChanged;
        return { done, cursor: done ? null : cursor, stats: { ...stats, phase: cursor.phase } };
      }
    },
  };
}

function isCursor(v: unknown): v is Cursor {
  return typeof v === "object" && v !== null && PHASES.includes((v as Cursor).phase) && typeof (v as Cursor).i === "number";
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let y = a; y <= b; y++) out.push(y);
  return out;
}

/**
 * Official files linked from the stored pages that are not stored yet. TXT is preferred; a PDF is
 * fetched only for a draw date that has no TXT (some draws are published as PDF only).
 */
async function filesToFetch(db: Db, keep: (code: string, date: string | null) => boolean): Promise<string[]> {
  const pages = await documentsByUrl(db, Object.values(OFFICIAL_PAGES));
  const links = [...listingIndex([...pages.values()]).values()].filter((l) => l.format !== "doc" && keep(l.denominationCode, l.drawDate));
  const txtDates = new Set(links.filter((l) => l.format === "txt").map((l) => `${l.denominationCode}|${l.drawDate}`));
  const wanted = links.filter((l) => l.format === "txt" || !txtDates.has(`${l.denominationCode}|${l.drawDate}`)).map((l) => l.url);
  const stored = await documentsByUrl(db, wanted);
  return wanted.filter((u) => !stored.has(u));
}

/** Every candidate from every stored document, grouped into draws. */
async function buildClusters(
  db: Db,
  keep: (code: string, date: string | null) => boolean,
): Promise<{ clusters: Cluster[]; rejected: number }> {
  const official = await documentsBySource(db, "savings_gov_pk");
  const context = { listing: listingIndex(official.filter((d) => Object.values(OFFICIAL_PAGES).includes(d.url))) };
  const docs = [
    ...official,
    ...(await documentsBySource(db, "savings_gov_pk_legacy")),
    ...(await documentsBySource(db, "prizeinfo_net")),
    ...(await documentsBySource(db, "legacy_db_snapshot")),
  ];
  // The same URL may have been stored more than once (a page that changed); keep the latest.
  const latest = new Map<string, StoredDocument>();
  for (const d of docs) {
    const prev = latest.get(d.url);
    if (!prev || prev.fetchedAt < d.fetchedAt) latest.set(d.url, d);
  }
  const candidates = [...latest.values()].flatMap((d) => candidatesFromDocument(d, context)).filter((c) => keep(c.denominationCode, c.drawDate));
  const { clusters, rejected } = clusterCandidates(candidates);
  clusters.sort((a, b) =>
    a.denominationCode === b.denominationCode
      ? (a.candidates[0]!.drawDate ?? "").localeCompare(b.candidates[0]!.drawDate ?? "")
      : a.denominationCode.localeCompare(b.denominationCode),
  );
  return { clusters, rejected: rejected.length };
}
