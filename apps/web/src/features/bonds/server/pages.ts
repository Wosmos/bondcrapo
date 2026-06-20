import "server-only";
import { unstable_cache } from "next/cache";
import type { CoverageRow, DenominationRow, DrawRow } from "@bondcheck/db/queries/bonds";
import { DataUnavailableError, read } from "./repo";

/**
 * Cached loaders for the bond pages. Results are plain JSON (the cache serialises them) and
 * tagged so an ingest commit revalidates exactly what changed: `bonds`, `bonds:<code>`,
 * `draw:<id>` (apps/web/src/platform/revalidate.ts). A failed read is never cached.
 */
export interface DrawView {
  id: number;
  code: string;
  drawNumber: number | null;
  drawDate: string;
  city: string | null;
  status: "scheduled" | "published" | "verified" | "disputed";
  completeness: "none" | "top" | "full";
  checksum: string | null;
}

export interface DrawPageView {
  draw: DrawView;
  prizes: { tier: number; amountPkr: number; winnersCount: number; inferred: boolean }[];
  tier1: number[];
  tier2: number[];
  tier3: number[];
  sources: { source: string; url: string; sha256: string; fetchedAt: string; role: "primary" | "corroborating" | "conflicting"; parsedCount: number }[];
  previous: DrawView | null;
  next: DrawView | null;
}

export type DenominationView = Pick<DenominationRow, "code" | "faceValue" | "kind" | "status" | "drawsPerYear" | "notesEn" | "notesUr">;

export function toView(row: DrawRow): DrawView {
  return {
    id: row.id,
    code: row.denominationCode,
    drawNumber: row.drawNumber,
    drawDate: row.drawDate,
    city: row.city,
    status: row.status as DrawView["status"],
    completeness: row.completeness as DrawView["completeness"],
    checksum: row.resultChecksum,
  };
}

const HOUR = 3600;

export const loadDenominations = unstable_cache(
  async (): Promise<DenominationView[]> =>
    (await read((r) => r.denominations())).map(({ code, faceValue, kind, status, drawsPerYear, notesEn, notesUr }) => ({
      code,
      faceValue,
      kind,
      status,
      drawsPerYear,
      notesEn,
      notesUr,
    })),
  ["bonds:denominations"],
  { tags: ["bonds"], revalidate: 24 * HOUR },
);

export const loadHub = unstable_cache(
  async (today: string) => {
    const [latest, upcoming] = await read((r) => Promise.all([r.latest(), r.upcoming(today)]));
    const firsts = await read((r) => r.firstPrizes(latest.map((d) => d.id)));
    return {
      latest: latest.map((d) => ({ draw: toView(d), firstPrizes: firsts.get(d.id) ?? [] })),
      upcoming: upcoming.map(toView),
    };
  },
  ["bonds:hub"],
  { tags: ["bonds"], revalidate: HOUR },
);

export const loadDenomination = unstable_cache(
  async (code: string, today: string) => {
    const [draws, upcoming] = await read((r) => Promise.all([r.drawsOfDenomination(code), r.upcoming(today, code)]));
    const latestHeld = draws.find((d) => d.completeness !== "none");
    const detail = latestHeld ? await read((r) => r.drawDetail(latestHeld)) : null;
    const firsts = await read((r) => r.firstPrizes(draws.filter((d) => d.completeness !== "none").map((d) => d.id)));
    return {
      draws: draws.map((d) => ({ ...toView(d), firstPrizes: firsts.get(d.id) ?? [] })),
      next: upcoming[0] ? toView(upcoming[0]) : null,
      latestPrizes: detail ? { drawDate: detail.draw.drawDate, prizes: detail.prizes } : null,
    };
  },
  ["bonds:denomination"],
  { tags: ["bonds"], revalidate: HOUR },
);

export const loadDraw = unstable_cache(
  async (code: string, drawNumber: number): Promise<DrawPageView | null> => {
    const draw = await read((r) => r.drawByNumber(code, drawNumber));
    if (!draw) return null;
    const [detail, results, siblings] = await read((r) =>
      Promise.all([r.drawDetail(draw), r.resultsPage(draw.id, { tier: 3, page: 1, pageSize: 5000 }), r.drawsOfDenomination(code)]),
    );
    const numbered = siblings.filter((d) => d.drawNumber !== null).sort((a, b) => a.drawDate.localeCompare(b.drawDate));
    const at = numbered.findIndex((d) => d.id === draw.id);
    return {
      draw: toView(draw),
      prizes: detail.prizes,
      tier1: detail.tier1,
      tier2: detail.tier2,
      tier3: results.items.map((i) => i.bondNumber),
      sources: detail.sources.map((s) => ({ ...s, fetchedAt: new Date(s.fetchedAt).toISOString() })),
      previous: at > 0 ? toView(numbered[at - 1]!) : null,
      next: at >= 0 && at < numbered.length - 1 ? toView(numbered[at + 1]!) : null,
    };
  },
  ["bonds:draw"],
  { tags: ["bonds"], revalidate: 6 * HOUR },
);

export const loadSchedule = unstable_cache(
  async (year: number) => (await read((r) => r.drawsInYear(year))).map(toView),
  ["bonds:schedule"],
  { tags: ["bonds"], revalidate: 6 * HOUR },
);

export const loadCoverage = unstable_cache(
  async (today: string): Promise<CoverageRow[]> => read((r) => r.coverage(today)),
  ["bonds:coverage"],
  { tags: ["bonds"], revalidate: 6 * HOUR },
);

/** Latest numbered draws per denomination, for `generateStaticParams`. Empty without a database. */
export async function recentDrawParams(perDenomination = 8): Promise<{ code: string; drawNumber: number }[]> {
  try {
    const rows = await read((r) => r.latest());
    const out: { code: string; drawNumber: number }[] = [];
    for (const latest of rows) {
      const draws = await read((r) => r.drawsOfDenomination(latest.denominationCode));
      for (const d of draws.filter((x) => x.drawNumber !== null && x.completeness !== "none").slice(0, perDenomination)) {
        out.push({ code: d.denominationCode, drawNumber: d.drawNumber! });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Runs a page loader; `null` when the data source is unavailable so the page can say so. */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof DataUnavailableError) return { ok: false };
    throw error;
  }
}
