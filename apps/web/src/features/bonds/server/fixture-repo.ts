import "server-only";
import { readdirSync } from "node:fs";
import { computeCoverage, type DrawDetailView, type DrawRow, type WinRow } from "@bondcheck/db/queries/bonds";
import { sha256Hex } from "@bondcheck/ingest";
import { candidatesFromDocument, listingIndex, type StoredDocument } from "@bondcheck/ingest/bonds/documents";
import { FIXTURE_DIR, fixtureBytes, fixtureRoutes, fixtureText } from "@bondcheck/ingest/bonds/fixtures";
import { clusterCandidates, decideDraw } from "@bondcheck/ingest/bonds/reconcile";
import { DENOMINATION_SEED } from "@bondcheck/ingest/bonds/seed";
import { OFFICIAL_LEGACY_BASE } from "@bondcheck/ingest/bonds/sources";
import { todayInPakistan } from "../format";
import type { BondsRepo } from "./repo";

interface Store {
  draws: DrawRow[];
  results: Map<number, { bondNumber: number; tier: number }[]>;
  details: Map<number, Omit<DrawDetailView, "draw" | "tier1" | "tier2">>;
  links: { drawId: number; source: string; url: string; role: string; parsedCount: number }[];
}

let building: Promise<Store> | null = null;

/**
 * Builds the bond data in memory from the recorded official documents (no legacy snapshot, no
 * PDFs): the same parsers and reconciliation as the backfill, so pages show real draws offline.
 */
async function build(): Promise<Store> {
  const dir = process.env.BONDS_FIXTURE_DIR ?? FIXTURE_DIR;
  const fetchedAt = new Date("2026-10-15T00:00:00Z");
  const docs: StoredDocument[] = [];
  for (const [url, rel] of fixtureRoutes(dir)) {
    if (rel.endsWith(".pdf")) continue;
    docs.push({
      sha256: await sha256Hex(fixtureBytes(rel, dir)),
      source: rel.startsWith("prizeinfo_net") ? "prizeinfo_net" : "savings_gov_pk",
      url,
      fetchedAt,
      contentType: null,
      bytes: null,
      body: fixtureText(rel, dir),
    });
  }
  for (const f of readdirSync(`${dir}savings_gov_pk_legacy/date-lists`)) {
    const id = /ajax-(\d+)\.html/.exec(f)?.[1];
    if (!id) continue;
    const body = fixtureText(`savings_gov_pk_legacy/date-lists/${f}`, dir);
    docs.push({ sha256: await sha256Hex(body), source: "savings_gov_pk_legacy", url: `${OFFICIAL_LEGACY_BASE}/ajaxData.php#id=${id}`, fetchedAt, contentType: null, bytes: null, body });
  }
  const context = { listing: listingIndex(docs.filter((d) => /savings\.gov\.pk\/[a-z0-9-]+$/.test(d.url))) };
  const { clusters } = clusterCandidates(docs.flatMap((d) => candidatesFromDocument(d, context)));
  const today = todayInPakistan();
  const byUrl = new Map(docs.map((d) => [d.sha256, d]));

  const store: Store = { draws: [], results: new Map(), details: new Map(), links: [] };
  let id = 0;
  const seen = new Set<string>();
  for (const cluster of clusters) {
    const d = await decideDraw(cluster.candidates, today);
    const key = `${d.denominationCode}|${d.drawNumber ?? d.drawDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    id++;
    store.draws.push({
      id,
      denominationCode: d.denominationCode,
      drawNumber: d.drawNumber,
      drawDate: d.drawDate,
      city: d.city,
      status: d.status,
      completeness: d.completeness,
      resultChecksum: d.checksum,
      publishedAt: d.status === "scheduled" ? null : fetchedAt,
      verifiedAt: d.status === "verified" ? fetchedAt : null,
      updatedAt: fetchedAt,
    });
    store.results.set(id, d.results.map((r) => ({ bondNumber: r.bondNumber, tier: r.tier })));
    store.details.set(id, {
      prizes: d.prizes.map((p) => ({ tier: p.tier, amountPkr: p.amountPkr, winnersCount: p.winnersCount, inferred: p.inferred })),
      sources: d.sources.map((s) => {
        const doc = byUrl.get(s.documentSha256)!;
        return { source: doc.source, url: doc.url, sha256: doc.sha256, fetchedAt: doc.fetchedAt, role: s.role, parsedCount: s.parsedCount };
      }),
    });
    for (const s of d.sources) {
      const doc = byUrl.get(s.documentSha256)!;
      store.links.push({ drawId: id, source: doc.source, url: doc.url, role: s.role, parsedCount: s.parsedCount });
    }
  }
  return store;
}

const HELD = new Set(["published", "verified", "disputed"]);
const byDateDesc = (a: DrawRow, b: DrawRow) => b.drawDate.localeCompare(a.drawDate) || b.id - a.id;

export async function fixtureRepo(): Promise<BondsRepo> {
  building ??= build();
  const s = await building;
  return {
    db: null,
    denominations: async () => DENOMINATION_SEED.map((d) => ({ ...d })),
    latest: async () => {
      const seen = new Set<string>();
      return s.draws
        .filter((d) => HELD.has(d.status))
        .sort(byDateDesc)
        .filter((d) => (seen.has(d.denominationCode) ? false : (seen.add(d.denominationCode), true)));
    },
    listDraws: async ({ denomination, year, cursor, limit = 50 }) => {
      const rows = s.draws
        .filter((d) => HELD.has(d.status) && (!denomination || d.denominationCode === denomination) && (!year || d.drawDate.startsWith(`${year}-`)))
        .sort(byDateDesc)
        .filter((d) => !cursor || d.drawDate < cursor.drawDate || (d.drawDate === cursor.drawDate && d.id < cursor.id));
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      return { rows: page, nextCursor: rows.length > limit && last ? { drawDate: last.drawDate, id: last.id } : null };
    },
    drawsOfDenomination: async (code) => s.draws.filter((d) => d.denominationCode === code && d.status !== "scheduled").sort(byDateDesc),
    drawByNumber: async (code, n) => s.draws.find((d) => d.denominationCode === code && d.drawNumber === n),
    drawDetail: async (draw) => {
      const results = s.results.get(draw.id) ?? [];
      const detail = s.details.get(draw.id)!;
      return {
        draw,
        ...detail,
        tier1: results.filter((r) => r.tier === 1).map((r) => r.bondNumber).sort((a, b) => a - b),
        tier2: results.filter((r) => r.tier === 2).map((r) => r.bondNumber).sort((a, b) => a - b),
      };
    },
    resultsPage: async (drawId, { tier, page, pageSize }) => {
      const all = (s.results.get(drawId) ?? []).filter((r) => !tier || r.tier === tier).sort((a, b) => a.tier - b.tier || a.bondNumber - b.bondNumber);
      return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
    },
    allResults: async (drawId) => [...(s.results.get(drawId) ?? [])].sort((a, b) => a.tier - b.tier || a.bondNumber - b.bondNumber),
    drawsInYear: async (year) => s.draws.filter((d) => d.drawDate.startsWith(`${year}-`)).sort((a, b) => a.drawDate.localeCompare(b.drawDate)),
    upcoming: async (today, code) => {
      const seen = new Set<string>();
      return s.draws
        .filter((d) => d.status === "scheduled" && d.drawDate >= today && (!code || d.denominationCode === code))
        .sort((a, b) => a.drawDate.localeCompare(b.drawDate))
        .filter((d) => (seen.has(d.denominationCode) ? false : (seen.add(d.denominationCode), true)));
    },
    coverage: async (today) =>
      computeCoverage(
        {
          denominations: DENOMINATION_SEED.map((d) => ({ code: d.code, drawsPerYear: d.drawsPerYear })),
          draws: s.draws.map((d) => ({ id: d.id, code: d.denominationCode, drawDate: d.drawDate, status: d.status, completeness: d.completeness })),
          links: s.links,
        },
        today,
      ),
    firstPrizes: async (ids) =>
      new Map(ids.map((id) => [id, (s.results.get(id) ?? []).filter((r) => r.tier === 1).map((r) => r.bondNumber).sort((a, b) => a - b)])),
    findWins: async (numbers, codes) => {
      const wanted = new Set(numbers);
      const out: WinRow[] = [];
      for (const d of s.draws) {
        if (!HELD.has(d.status) || (codes?.length && !codes.includes(d.denominationCode))) continue;
        for (const r of s.results.get(d.id) ?? []) {
          if (!wanted.has(r.bondNumber)) continue;
          const prize = s.details.get(d.id)?.prizes.find((p) => p.tier === r.tier);
          out.push({
            bondNumber: r.bondNumber,
            tier: r.tier,
            drawId: d.id,
            denominationCode: d.denominationCode,
            drawNumber: d.drawNumber,
            drawDate: d.drawDate,
            status: d.status,
            amountPkr: prize?.amountPkr ?? null,
            amountInferred: prize?.inferred ?? false,
          });
        }
      }
      return out.sort((a, b) => b.drawDate.localeCompare(a.drawDate) || a.tier - b.tier);
    },
  };
}
