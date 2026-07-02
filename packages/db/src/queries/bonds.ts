import { and, asc, count, desc, eq, gte, inArray, lte, ne, or, sql, lt } from "drizzle-orm";
import type { Db } from "../client";
import {
  denominations,
  drawPrizes,
  drawResults,
  draws,
  drawSources,
  sourceDocuments,
} from "../schema";

/**
 * Read queries for prize bonds (Lane A). They take the driver neutral `Db`, so the same code
 * serves Neon HTTP in production and PGlite in tests. Dates are ISO strings, timestamps are
 * `Date`s; bond numbers are integers (format them with `formatBondNumber`).
 */

export type DrawRow = typeof draws.$inferSelect;
export type DenominationRow = typeof denominations.$inferSelect;

/** Statuses that carry results or are known to have taken place (everything but `scheduled`). */
const HELD = ["published", "verified", "disputed"] as const;

export async function listDenominations(db: Db): Promise<DenominationRow[]> {
  const rows = await db.select().from(denominations);
  const order = ["100", "200", "750", "1500", "25000P", "40000P", "7500", "15000", "25000", "40000"];
  return rows.sort((a, b) => (order.indexOf(a.code) + 1 || 99) - (order.indexOf(b.code) + 1 || 99));
}

export async function getDenomination(db: Db, code: string): Promise<DenominationRow | undefined> {
  const [row] = await db.select().from(denominations).where(eq(denominations.code, code));
  return row;
}

export interface DrawListCursor {
  drawDate: string;
  id: number;
}

export function encodeDrawCursor(c: DrawListCursor): string {
  return Buffer.from(`${c.drawDate}|${c.id}`, "utf8").toString("base64url");
}

export function decodeDrawCursor(value: string | undefined | null): DrawListCursor | null {
  if (!value) return null;
  try {
    const [drawDate, id] = Buffer.from(value, "base64url").toString("utf8").split("|");
    if (!drawDate || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate) || !id || !/^\d+$/.test(id)) return null;
    return { drawDate, id: Number(id) };
  } catch {
    return null;
  }
}

/** Held draws, newest first, keyset paginated by (draw date, id). */
export async function listDraws(
  db: Db,
  opts: { denomination?: string; year?: number; cursor?: DrawListCursor | null; limit?: number } = {},
): Promise<{ rows: DrawRow[]; nextCursor: DrawListCursor | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const where = [inArray(draws.status, [...HELD])];
  if (opts.denomination) where.push(eq(draws.denominationCode, opts.denomination));
  if (opts.year) {
    where.push(gte(draws.drawDate, `${opts.year}-01-01`), lte(draws.drawDate, `${opts.year}-12-31`));
  }
  if (opts.cursor) {
    where.push(
      or(lt(draws.drawDate, opts.cursor.drawDate), and(eq(draws.drawDate, opts.cursor.drawDate), lt(draws.id, opts.cursor.id)))!,
    );
  }
  const rows = await db
    .select()
    .from(draws)
    .where(and(...where))
    .orderBy(desc(draws.drawDate), desc(draws.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { rows: page, nextCursor: rows.length > limit && last ? { drawDate: last.drawDate, id: last.id } : null };
}

export async function getDrawByNumber(db: Db, code: string, drawNumber: number): Promise<DrawRow | undefined> {
  const [row] = await db
    .select()
    .from(draws)
    .where(and(eq(draws.denominationCode, code), eq(draws.drawNumber, drawNumber)));
  return row;
}

export async function getDrawById(db: Db, id: number): Promise<DrawRow | undefined> {
  const [row] = await db.select().from(draws).where(eq(draws.id, id));
  return row;
}

export interface DrawSourceView {
  source: string;
  url: string;
  sha256: string;
  fetchedAt: Date;
  role: "primary" | "corroborating" | "conflicting";
  parsedCount: number;
}

export interface DrawDetailView {
  draw: DrawRow;
  prizes: { tier: number; amountPkr: number; winnersCount: number; inferred: boolean }[];
  tier1: number[];
  tier2: number[];
  sources: DrawSourceView[];
}

export async function getDrawDetail(db: Db, draw: DrawRow): Promise<DrawDetailView> {
  const [prizes, top, sources] = await Promise.all([
    db.select().from(drawPrizes).where(eq(drawPrizes.drawId, draw.id)).orderBy(asc(drawPrizes.tier)),
    db
      .select({ bondNumber: drawResults.bondNumber, tier: drawResults.tier })
      .from(drawResults)
      .where(and(eq(drawResults.drawId, draw.id), lte(drawResults.tier, 2)))
      .orderBy(asc(drawResults.tier), asc(drawResults.bondNumber)),
    db
      .select({
        source: sourceDocuments.source,
        url: sourceDocuments.url,
        sha256: sourceDocuments.sha256,
        fetchedAt: sourceDocuments.fetchedAt,
        role: drawSources.role,
        parsedCount: drawSources.parsedCount,
      })
      .from(drawSources)
      .innerJoin(sourceDocuments, eq(sourceDocuments.sha256, drawSources.documentSha256))
      .where(eq(drawSources.drawId, draw.id)),
  ]);
  const roleOrder = { primary: 0, corroborating: 1, conflicting: 2 } as const;
  return {
    draw,
    prizes: prizes.map((p) => ({ tier: p.tier, amountPkr: p.amountPkr, winnersCount: p.winnersCount, inferred: p.inferred === 1 })),
    tier1: top.filter((r) => r.tier === 1).map((r) => r.bondNumber),
    tier2: top.filter((r) => r.tier === 2).map((r) => r.bondNumber),
    sources: (sources as DrawSourceView[]).sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.source.localeCompare(b.source)),
  };
}

export async function getDrawResultsPage(
  db: Db,
  drawId: number,
  opts: { tier?: number; page: number; pageSize: number },
): Promise<{ items: { bondNumber: number; tier: number }[]; total: number }> {
  const where = opts.tier ? and(eq(drawResults.drawId, drawId), eq(drawResults.tier, opts.tier)) : eq(drawResults.drawId, drawId);
  const [items, [totals]] = await Promise.all([
    db
      .select({ bondNumber: drawResults.bondNumber, tier: drawResults.tier })
      .from(drawResults)
      .where(where)
      .orderBy(asc(drawResults.tier), asc(drawResults.bondNumber))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ n: count() }).from(drawResults).where(where),
  ]);
  return { items, total: Number(totals?.n ?? 0) };
}

export async function getAllDrawResults(db: Db, drawId: number): Promise<{ bondNumber: number; tier: number }[]> {
  return db
    .select({ bondNumber: drawResults.bondNumber, tier: drawResults.tier })
    .from(drawResults)
    .where(eq(drawResults.drawId, drawId))
    .orderBy(asc(drawResults.tier), asc(drawResults.bondNumber));
}

/** The most recent held draw of every denomination. */
export async function latestDraws(db: Db): Promise<DrawRow[]> {
  const res = await db.execute(sql`
    select distinct on (denomination_code) id from draws
     where status in ('published', 'verified', 'disputed')
     order by denomination_code, draw_date desc`);
  const ids = rowsOf<{ id: number }>(res).map((r) => Number(r.id));
  if (!ids.length) return [];
  const rows = await db.select().from(draws).where(inArray(draws.id, ids));
  return rows.sort((a, b) => b.drawDate.localeCompare(a.drawDate));
}

/** All draws (held and scheduled) in a calendar year, by date. */
export async function drawsInYear(db: Db, year: number): Promise<DrawRow[]> {
  return db
    .select()
    .from(draws)
    .where(and(gte(draws.drawDate, `${year}-01-01`), lte(draws.drawDate, `${year}-12-31`)))
    .orderBy(asc(draws.drawDate), asc(draws.denominationCode));
}

/** The next scheduled draw per denomination on or after `today`. */
export async function upcomingDraws(db: Db, today: string, code?: string): Promise<DrawRow[]> {
  const where = [gte(draws.drawDate, today), eq(draws.status, "scheduled")];
  if (code) where.push(eq(draws.denominationCode, code));
  const rows = await db.select().from(draws).where(and(...where)).orderBy(asc(draws.drawDate));
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.denominationCode) ? false : (seen.add(r.denominationCode), true)));
}

/** Every held draw of a denomination, newest first (for the denomination page and sitemaps). */
export async function drawsOfDenomination(db: Db, code: string): Promise<DrawRow[]> {
  return db
    .select()
    .from(draws)
    .where(and(eq(draws.denominationCode, code), ne(draws.status, "scheduled")))
    .orderBy(desc(draws.drawDate));
}

/** First prize numbers of the given draws in one query (draw id to numbers). */
export async function firstPrizes(db: Db, drawIds: readonly number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (!drawIds.length) return out;
  const rows = await db
    .select({ drawId: drawResults.drawId, bondNumber: drawResults.bondNumber })
    .from(drawResults)
    .where(and(inArray(drawResults.drawId, [...drawIds]), eq(drawResults.tier, 1)))
    .orderBy(asc(drawResults.bondNumber));
  for (const r of rows) out.set(r.drawId, [...(out.get(r.drawId) ?? []), r.bondNumber]);
  return out;
}

export interface WinRow {
  bondNumber: number;
  tier: number;
  drawId: number;
  denominationCode: string;
  drawNumber: number | null;
  drawDate: string;
  status: string;
  amountPkr: number | null;
  amountInferred: boolean;
}

/**
 * Every win of the given numbers across all held draws (one indexed lookup on
 * `draw_results.bond_number`). Optional denomination filter; prize amounts come from the draw's
 * own prize table and are null when no document states them.
 */
export async function findWins(db: Db, numbers: readonly number[], denominationCodes?: readonly string[]): Promise<WinRow[]> {
  if (!numbers.length) return [];
  const unique = [...new Set(numbers)];
  const where = [inArray(drawResults.bondNumber, unique), ne(draws.status, "scheduled")];
  if (denominationCodes?.length) where.push(inArray(draws.denominationCode, [...denominationCodes]));
  const rows = await db
    .select({
      bondNumber: drawResults.bondNumber,
      tier: drawResults.tier,
      drawId: draws.id,
      denominationCode: draws.denominationCode,
      drawNumber: draws.drawNumber,
      drawDate: draws.drawDate,
      status: draws.status,
      amountPkr: drawPrizes.amountPkr,
      inferred: drawPrizes.inferred,
    })
    .from(drawResults)
    .innerJoin(draws, eq(draws.id, drawResults.drawId))
    .leftJoin(drawPrizes, and(eq(drawPrizes.drawId, drawResults.drawId), eq(drawPrizes.tier, drawResults.tier)))
    .where(and(...where))
    .orderBy(desc(draws.drawDate), asc(drawResults.tier));
  return rows.map((r) => ({
    bondNumber: r.bondNumber,
    tier: r.tier,
    drawId: r.drawId,
    denominationCode: r.denominationCode,
    drawNumber: r.drawNumber,
    drawDate: r.drawDate,
    status: r.status,
    amountPkr: r.amountPkr ?? null,
    amountInferred: r.inferred === 1,
  }));
}

export interface CoverageRow {
  denominationCode: string;
  year: number;
  expected: number;
  full: number;
  top: number;
  none: number;
  verified: number;
  disputed: number;
  sources: Record<string, number>;
}

/** Source families as shown on the coverage page. */
function familyOf(source: string, url: string): string {
  if (source === "legacy_db_snapshot") return url.includes("source=prizeinfo_net") ? "prizeinfo_net" : "pkprizebond_com";
  if (source === "savings_gov_pk_legacy") return "savings_gov_pk";
  return source;
}

export interface CoverageInput {
  denominations: { code: string; drawsPerYear: number | null }[];
  draws: { id: number; code: string; drawDate: string; status: string; completeness: string }[];
  links: { drawId: number; source: string; url: string; role: string; parsedCount: number }[];
}

/**
 * Coverage per denomination and year from `firstYear` to the year of `today`: expected draws, how
 * many have a full list, top prizes only or nothing, how many are verified or disputed, and which
 * sources contributed. A year between a denomination's first and last held draw expects at least
 * its draws per year; catalogued draws without results count as `none`. Pure, so the same numbers
 * come from the database and from the recorded fixtures.
 */
export function computeCoverage(input: CoverageInput, today: string, firstYear = 1999): CoverageRow[] {
  const lastYear = Number(today.slice(0, 4));
  const held = input.draws.filter((d) => d.drawDate <= today);
  const familiesByDraw = new Map<number, Set<string>>();
  for (const l of input.links) {
    if (l.parsedCount === 0 || l.role === "conflicting") continue;
    const set = familiesByDraw.get(l.drawId) ?? new Set<string>();
    set.add(familyOf(l.source, l.url));
    familiesByDraw.set(l.drawId, set);
  }
  const out: CoverageRow[] = [];
  for (const d of input.denominations) {
    const mine = held.filter((h) => h.code === d.code);
    const years = mine.map((h) => Number(h.drawDate.slice(0, 4)));
    const first = years.length ? Math.min(...years) : null;
    const last = years.length ? Math.max(...years) : null;
    for (let year = firstYear; year <= lastYear; year++) {
      const inYear = mine.filter((h) => h.drawDate.startsWith(`${year}-`));
      const full = inYear.filter((h) => h.completeness === "full").length;
      const top = inYear.filter((h) => h.completeness === "top").length;
      let expected = inYear.length;
      if (first !== null && last !== null && year > first && year < last) expected = Math.max(expected, d.drawsPerYear ?? 4);
      const sources: Record<string, number> = {};
      for (const h of inYear) for (const f of familiesByDraw.get(h.id) ?? []) sources[f] = (sources[f] ?? 0) + 1;
      out.push({
        denominationCode: d.code,
        year,
        expected,
        full,
        top,
        none: Math.max(expected - full - top, 0),
        verified: inYear.filter((h) => h.status === "verified").length,
        disputed: inYear.filter((h) => h.status === "disputed").length,
        sources,
      });
    }
  }
  return out;
}

export async function coverageRows(db: Db, today: string, firstYear = 1999): Promise<CoverageRow[]> {
  const [denoms, rows, links] = await Promise.all([
    listDenominations(db),
    db
      .select({ id: draws.id, code: draws.denominationCode, drawDate: draws.drawDate, status: draws.status, completeness: draws.completeness })
      .from(draws),
    db
      .select({ drawId: drawSources.drawId, source: sourceDocuments.source, url: sourceDocuments.url, role: drawSources.role, parsedCount: drawSources.parsedCount })
      .from(drawSources)
      .innerJoin(sourceDocuments, eq(sourceDocuments.sha256, drawSources.documentSha256)),
  ]);
  return computeCoverage({ denominations: denoms, draws: rows, links }, today, firstYear);
}

function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

export interface BondsFreshness {
  /** Draws that took place and carry results. */
  heldDraws: number;
  /** Date of the newest draw with results. */
  latestDrawDate: string | null;
  /** Newest official or reference document fetched, per source. */
  documents: { source: string; latestFetchedAt: Date }[];
}

/** How current the prize bond data is, for the data sources page. */
export async function bondsFreshness(db: Db): Promise<BondsFreshness> {
  const [held] = await db
    .select({ n: count(), latest: sql<string | null>`max(${draws.drawDate})` })
    .from(draws)
    .where(inArray(draws.status, [...HELD]));
  const docs = await db
    .select({ source: sourceDocuments.source, latest: sql<Date | string>`max(${sourceDocuments.fetchedAt})` })
    .from(sourceDocuments)
    .groupBy(sourceDocuments.source)
    .orderBy(asc(sourceDocuments.source));
  return {
    heldDraws: Number(held?.n ?? 0),
    latestDrawDate: held?.latest ?? null,
    documents: docs.map((d) => ({ source: d.source, latestFetchedAt: new Date(d.latest) })),
  };
}
