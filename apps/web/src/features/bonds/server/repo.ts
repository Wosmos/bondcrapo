import "server-only";
import type { Db } from "@bondcheck/db";
import * as q from "@bondcheck/db/queries/bonds";
import type {
  CoverageRow,
  DenominationRow,
  DrawDetailView,
  DrawListCursor,
  DrawRow,
  WinRow,
} from "@bondcheck/db/queries/bonds";
import { getDb } from "@/server/db";

/** Everything the bond pages and API read. One implementation per data source. */
export interface BondsRepo {
  denominations(): Promise<DenominationRow[]>;
  latest(): Promise<DrawRow[]>;
  listDraws(opts: { denomination?: string; year?: number; cursor?: DrawListCursor | null; limit?: number }): Promise<{
    rows: DrawRow[];
    nextCursor: DrawListCursor | null;
  }>;
  drawsOfDenomination(code: string): Promise<DrawRow[]>;
  drawByNumber(code: string, drawNumber: number): Promise<DrawRow | undefined>;
  drawDetail(draw: DrawRow): Promise<DrawDetailView>;
  resultsPage(drawId: number, opts: { tier?: number; page: number; pageSize: number }): Promise<{ items: { bondNumber: number; tier: number }[]; total: number }>;
  allResults(drawId: number): Promise<{ bondNumber: number; tier: number }[]>;
  drawsInYear(year: number): Promise<DrawRow[]>;
  upcoming(today: string, code?: string): Promise<DrawRow[]>;
  coverage(today: string): Promise<CoverageRow[]>;
  findWins(numbers: readonly number[], codes?: readonly string[]): Promise<WinRow[]>;
  firstPrizes(drawIds: readonly number[]): Promise<Map<number, number[]>>;
  /** The database handle when there is one (rate limiting needs it). */
  db: Db | null;
}

export function dbRepo(db: Db): BondsRepo {
  return {
    db,
    denominations: () => q.listDenominations(db),
    latest: () => q.latestDraws(db),
    listDraws: (opts) => q.listDraws(db, opts),
    drawsOfDenomination: (code) => q.drawsOfDenomination(db, code),
    drawByNumber: (code, n) => q.getDrawByNumber(db, code, n),
    drawDetail: (draw) => q.getDrawDetail(db, draw),
    resultsPage: (id, opts) => q.getDrawResultsPage(db, id, opts),
    allResults: (id) => q.getAllDrawResults(db, id),
    drawsInYear: (year) => q.drawsInYear(db, year),
    upcoming: (today, code) => q.upcomingDraws(db, today, code),
    coverage: (today) => q.coverageRows(db, today),
    findWins: (numbers, codes) => q.findWins(db, numbers, codes),
    firstPrizes: (ids) => q.firstPrizes(db, ids),
  };
}

let override: BondsRepo | null = null;

/** Tests inject a PGlite backed repository here. */
export function setBondsRepoForTests(repo: BondsRepo | null): void {
  override = repo;
}

/**
 * The repository for this request. `BONDS_DATA=fixtures` serves the recorded official documents
 * from packages/ingest/fixtures without a database (local development and end to end tests);
 * production always uses the database.
 */
export async function bondsRepo(): Promise<BondsRepo> {
  if (override) return override;
  if (process.env.BONDS_DATA === "fixtures" && process.env.NODE_ENV !== "production") {
    const { fixtureRepo } = await import("./fixture-repo");
    return fixtureRepo();
  }
  return dbRepo(getDb());
}

export class DataUnavailableError extends Error {}

/** Runs a read and turns any database failure into one recognisable error (no details leak). */
export async function read<T>(fn: (repo: BondsRepo) => Promise<T>): Promise<T> {
  let repo: BondsRepo;
  try {
    repo = await bondsRepo();
  } catch (error) {
    throw new DataUnavailableError(error instanceof Error ? error.message : "no database");
  }
  try {
    return await fn(repo);
  } catch (error) {
    if (error instanceof DataUnavailableError) throw error;
    console.error("bonds read failed", error instanceof Error ? error.message : "unknown error");
    throw new DataUnavailableError("read failed");
  }
}
