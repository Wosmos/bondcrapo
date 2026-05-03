import type { DenominationCode } from "@bondcheck/shared";
import { sha256Hex } from "../fetcher";
import { daysBetween } from "./dates";
import { structureOn } from "./seed";
import { checkCandidate } from "./validate";
import { KIND_FAMILY, KIND_PRECEDENCE, type Candidate, type CandidateKind, type IssueInput, type Tier } from "./types";

export type DrawStatus = "scheduled" | "published" | "verified" | "disputed";
export type Completeness = "none" | "top" | "full";
export type SourceRole = "primary" | "corroborating" | "conflicting";

export interface DrawDecision {
  denominationCode: DenominationCode;
  drawDate: string;
  drawNumber: number | null;
  city: string | null;
  status: DrawStatus;
  completeness: Completeness;
  results: { tier: Tier; bondNumber: number }[];
  checksum: string | null;
  prizes: { tier: Tier; amountPkr: number; winnersCount: number; inferred: boolean }[];
  sources: { documentSha256: string; parserVersion: string; parsedCount: number; checksum: string | null; role: SourceRole }[];
  issues: IssueInput[];
}

/** Draws on the official result date for a draw after this date are trusted on a single official file. */
export const OFFICIAL_ALONE_FROM = "2019-01-01";
/** Draws of one denomination are three months apart; candidates within this window are the same draw. */
export const CLUSTER_WINDOW_DAYS = 10;

const fmt = (n: number) => String(n).padStart(6, "0");

/** Canonical `tier:number\n` list, sorted by tier then number. */
export function canonicalList(tiers: Partial<Record<Tier, readonly number[]>>): string {
  const lines: string[] = [];
  for (const t of [1, 2, 3] as const) for (const n of [...(tiers[t] ?? [])].sort((a, b) => a - b)) lines.push(`${t}:${fmt(n)}\n`);
  return lines.join("");
}

export async function listChecksum(tiers: Partial<Record<Tier, readonly number[]>>): Promise<string | null> {
  const body = canonicalList(tiers);
  return body ? sha256Hex(body) : null;
}

function sameSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((n) => s.has(n));
}

const byPrecedence = (a: Candidate, b: Candidate) => KIND_PRECEDENCE[a.kind] - KIND_PRECEDENCE[b.kind];

const DATE_ORDER: CandidateKind[] = [
  "official_catalog",
  "official_txt",
  "official_pdf",
  "official_spot",
  "manual",
  "prizeinfo_record",
  "prizeinfo_schedule",
  "legacy_pkprizebond",
  "legacy_prizeinfo",
];
const META_ORDER: CandidateKind[] = [
  "official_txt",
  "official_pdf",
  "official_spot",
  "manual",
  "prizeinfo_record",
  "prizeinfo_schedule",
  "legacy_prizeinfo",
  "legacy_pkprizebond",
];

function pick<T>(cands: Candidate[], order: CandidateKind[], get: (c: Candidate) => T | null): T | null {
  for (const kind of order) {
    for (const c of cands) {
      if (c.kind !== kind) continue;
      const v = get(c);
      if (v !== null && v !== undefined) return v;
    }
  }
  return null;
}

interface Working {
  c: Candidate;
  tiers: Partial<Record<Tier, number[]>>;
  valid: Partial<Record<Tier, boolean>>;
  reasons: Partial<Record<Tier, string>>;
  contradicted: boolean;
}

/**
 * Validates every candidate of one draw, repairs what can be proven, resolves conflicts by
 * precedence (official TXT > official PDF > legacy snapshot > prizeinfo.net) and sets the status:
 * `verified` when two independent sources agree on tiers 1 and 2 (or an official file alone for
 * draws since 2019), `disputed` when valid sources disagree, `published` otherwise.
 */
export async function decideDraw(candidates: Candidate[], today: string): Promise<DrawDecision> {
  const cands = [...candidates].sort(byPrecedence);
  const code = cands[0]!.denominationCode;
  const issues: IssueInput[] = [];
  const drawDate = pick(cands, DATE_ORDER, (c) => c.drawDate)!;

  const work: Working[] = cands.map((c) => {
    const check = checkCandidate({ ...c, drawDate: c.drawDate ?? drawDate });
    issues.push(...check.issues);
    const w: Working = { c, tiers: { ...c.tiers }, valid: {}, reasons: {}, contradicted: false };
    for (const t of [1, 2, 3] as const) {
      const r = check.tiers[t];
      if (!r) continue;
      w.valid[t] = r.valid;
      if (!r.valid) w.reasons[t] = r.reason;
    }
    return w;
  });

  // Official number search results (spot checks).
  const confirmed = new Map<number, Tier | null>();
  const denied = new Set<number>();
  for (const c of cands) {
    for (const s of c.spot ?? []) {
      if (s.won) confirmed.set(s.number, s.tier);
      else denied.add(s.number);
    }
  }

  // Repair: legacy lists that put a few third prizes under tier 1 or 2. When another source has a
  // valid set for that tier and the legacy set is a superset of it, and moving the extras into
  // tier 3 makes tier 3 exactly the expected size, the extras were mislabelled third prizes.
  for (const w of work) {
    if (w.c.kind !== "legacy_pkprizebond" && w.c.kind !== "legacy_prizeinfo") continue;
    for (const t of [1, 2] as const) {
      if (w.valid[t] !== false) continue;
      const ref = work.find((o) => o !== w && o.valid[t] && KIND_FAMILY[o.c.kind] !== KIND_FAMILY[w.c.kind]);
      const mine = w.tiers[t]!;
      const theirs = ref?.tiers[t];
      if (!theirs || !theirs.every((n) => mine.includes(n))) continue;
      const extras = mine.filter((n) => !theirs.includes(n));
      const third = w.tiers[3] ?? [];
      const expected3 = checkCandidate({ ...w.c, tiers: { 3: [...third, ...extras] } }).tiers[3];
      if (expected3?.valid && extras.every((n) => !third.includes(n))) {
        w.tiers[t] = [...theirs];
        w.tiers[3] = [...third, ...extras];
        w.valid[t] = true;
        w.valid[3] = true;
        delete w.reasons[t];
        delete w.reasons[3];
        issues.push({
          severity: "warn",
          message: `${w.c.kind}: ${extras.map(fmt).join(", ")} listed as tier ${t}, moved to tier 3 (matches ${ref!.c.kind} and the tier 3 count)`,
        });
      }
    }
  }

  // Official search contradicts a source: that tier is not trusted.
  for (const w of work) {
    for (const t of [1, 2] as const) {
      const set = w.tiers[t];
      if (!set || !w.valid[t]) continue;
      const bad = set.filter((n) => denied.has(n));
      const missing = [...confirmed.entries()].filter(([n, tier]) => tier === t && !set.includes(n)).map(([n]) => n);
      if (bad.length || missing.length) {
        w.valid[t] = false;
        w.contradicted = true;
        w.reasons[t] = "contradicted by the official number search";
        // A list with the wrong first prize is the list of some other draw: reject all of it.
        if (t === 1) {
          for (const other of [2, 3] as const) {
            if (w.tiers[other] && w.valid[other]) {
              w.valid[other] = false;
              w.reasons[other] = "first prize contradicted by the official number search, list rejected";
            }
          }
        }
        issues.push({
          severity: "warn",
          message: `${w.c.kind}: tier ${t} contradicted by the official number search (${[...bad, ...missing].map(fmt).join(", ")})`,
        });
      }
    }
  }

  for (const w of work) {
    for (const t of [1, 2, 3] as const) {
      if (w.reasons[t]) issues.push({ severity: "info", message: `${w.c.kind}: tier ${t} rejected: ${w.reasons[t]}` });
    }
  }

  // Choose each tier from the best valid source.
  const chosen: Partial<Record<Tier, { from: Working; numbers: number[] }>> = {};
  for (const t of [1, 2, 3] as const) {
    const best = work.find((w) => w.valid[t]);
    if (best) chosen[t] = { from: best, numbers: [...best.tiers[t]!].sort((a, b) => a - b) };
  }

  // Conflicts: another valid source with a different set for the same tier.
  const conflicts: string[] = [];
  for (const t of [1, 2, 3] as const) {
    const pickT = chosen[t];
    if (!pickT) continue;
    for (const w of work) {
      if (w === pickT.from || !w.valid[t]) continue;
      if (!sameSet(w.tiers[t]!, pickT.numbers)) {
        conflicts.push(`tier ${t}: ${pickT.from.c.kind} and ${w.c.kind} disagree`);
        if (t < 3) {
          const theirs = w.tiers[t]!.filter((n) => !pickT.numbers.includes(n));
          issues.push({
            severity: "error",
            message: `tier ${t} conflict: ${pickT.from.c.kind} has ${pickT.numbers.map(fmt).join(", ")}; ${w.c.kind} has ${theirs.map(fmt).join(", ")}`,
          });
        } else {
          issues.push({ severity: "error", message: `tier 3 lists of ${pickT.from.c.kind} and ${w.c.kind} differ` });
        }
      }
    }
  }

  // Tier 3 must not repeat a tier 1 or 2 number.
  if (chosen[3] && (chosen[1] || chosen[2])) {
    const top = new Set([...(chosen[1]?.numbers ?? []), ...(chosen[2]?.numbers ?? [])]);
    const clash = chosen[3].numbers.filter((n) => top.has(n));
    if (clash.length) {
      issues.push({ severity: "error", message: `tier 3 list repeats top prize numbers ${clash.map(fmt).join(", ")}; list dropped` });
      delete chosen[3];
    }
  }

  const hasTop = Boolean(chosen[1] && chosen[2]);
  const completeness: Completeness = hasTop ? (chosen[3] ? "full" : "top") : "none";
  if (!hasTop && chosen[1]) {
    issues.push({
      severity: "info",
      message: `only the first prize is established (${chosen[1].numbers.map(fmt).join(", ")}); no valid second prize list, nothing published`,
    });
  }
  const results: DrawDecision["results"] = [];
  if (hasTop) {
    for (const t of [1, 2, 3] as const) for (const n of chosen[t]?.numbers ?? []) results.push({ tier: t, bondNumber: n });
  }

  let status: DrawStatus;
  if (!hasTop) status = drawDate > today ? "scheduled" : "published";
  else if (conflicts.length) status = "disputed";
  else {
    const families = new Set<string>();
    for (const w of work) {
      if (w.valid[1] && w.valid[2] && sameSet(w.tiers[1]!, chosen[1]!.numbers) && sameSet(w.tiers[2]!, chosen[2]!.numbers)) {
        families.add(KIND_FAMILY[w.c.kind]);
      }
    }
    if (chosen[1]!.numbers.some((n) => confirmed.has(n))) families.add("official");
    const officialFile = chosen[1]!.from.c.kind === "official_txt" || chosen[1]!.from.c.kind === "official_pdf";
    status = families.size >= 2 || (officialFile && drawDate >= OFFICIAL_ALONE_FROM) ? "verified" : "published";
  }

  const numbers = new Set(cands.map((c) => c.drawNumber).filter((n): n is number => n !== null));
  const drawNumber = pick(cands, META_ORDER, (c) => c.drawNumber);
  if (numbers.size > 1) {
    issues.push({
      severity: "warn",
      message: `sources give draw numbers ${[...numbers].sort((a, b) => a - b).join(", ")}; using ${drawNumber}`,
      details: cands.filter((c) => c.drawNumber !== null).map((c) => ({ kind: c.kind, drawNumber: c.drawNumber })),
    });
  }
  const dates = new Set(cands.map((c) => c.drawDate).filter((d): d is string => d !== null));
  if (dates.size > 1) {
    issues.push({ severity: "info", message: `sources give dates ${[...dates].sort().join(", ")}; using ${drawDate}` });
  }

  const prizes: DrawDecision["prizes"] = [];
  if (hasTop) {
    const reference = structureOn(code, drawDate);
    for (const t of [1, 2, 3] as const) {
      const list = chosen[t];
      if (!list) continue;
      const stated = pick(cands, META_ORDER, (c) => c.prizes[t]?.amountPkr ?? null);
      const ref = reference[t];
      if (stated !== null && ref && ref.amountPkr !== stated) {
        issues.push({ severity: "warn", message: `tier ${t} amount ${stated} differs from the reference ${ref.amountPkr} (${ref.sourceUrl})` });
      }
      if (stated !== null) prizes.push({ tier: t, amountPkr: stated, winnersCount: list.numbers.length, inferred: false });
      else if (ref) prizes.push({ tier: t, amountPkr: ref.amountPkr, winnersCount: list.numbers.length, inferred: true });
    }
  }

  const sources: DrawDecision["sources"] = [];
  const seen = new Set<string>();
  const primary = chosen[1]?.from ?? work.find((w) => w.c.drawDate === drawDate) ?? work[0]!;
  for (const w of work) {
    if (seen.has(w.c.documentSha256)) continue;
    seen.add(w.c.documentSha256);
    let role: SourceRole = w === primary ? "primary" : "corroborating";
    if (w !== primary) {
      const disagrees = ([1, 2, 3] as const).some((t) => w.valid[t] && chosen[t] && !sameSet(w.tiers[t]!, chosen[t]!.numbers));
      if (disagrees || w.contradicted) role = "conflicting";
    }
    sources.push({
      documentSha256: w.c.documentSha256,
      parserVersion: w.c.parserVersion,
      parsedCount: (w.c.tiers[1]?.length ?? 0) + (w.c.tiers[2]?.length ?? 0) + (w.c.tiers[3]?.length ?? 0),
      checksum: await listChecksum(w.c.tiers),
      role,
    });
  }

  for (const c of cands) for (const note of c.notes ?? []) issues.push({ severity: "info", message: `${c.kind}: ${note}` });

  return {
    denominationCode: code,
    drawDate,
    drawNumber,
    city: pick(cands, META_ORDER, (c) => c.city),
    status,
    completeness,
    results,
    checksum: results.length ? await listChecksum(Object.fromEntries(([1, 2, 3] as const).map((t) => [t, chosen[t]?.numbers ?? []]))) : null,
    prizes,
    sources,
    issues,
  };
}

export interface Cluster {
  denominationCode: DenominationCode;
  candidates: Candidate[];
}

/**
 * Groups candidates into draws: same denomination, dates within CLUSTER_WINDOW_DAYS (sources
 * disagree by a few days, e.g. 01-Dec-2017 in the legacy snapshot is the 04-Dec-2017 draw on
 * the official list). Undated candidates join by draw number. A cluster seen only in the legacy
 * snapshot is rejected: every real draw since 2000 is in the official date list or the
 * prizeinfo.net record, so a snapshot-only date is a mislabelled list.
 */
export function clusterCandidates(all: readonly Candidate[]): { clusters: Cluster[]; rejected: Cluster[] } {
  const byDenom = new Map<DenominationCode, Candidate[]>();
  for (const c of all) byDenom.set(c.denominationCode, [...(byDenom.get(c.denominationCode) ?? []), c]);
  const clusters: Cluster[] = [];
  const rejected: Cluster[] = [];
  for (const [code, list] of byDenom) {
    const dated = list.filter((c) => c.drawDate).sort((a, b) => a.drawDate!.localeCompare(b.drawDate!));
    const groups: { start: string; items: Candidate[] }[] = [];
    for (const c of dated) {
      const g = groups[groups.length - 1];
      if (g && daysBetween(g.start, c.drawDate!) <= CLUSTER_WINDOW_DAYS) g.items.push(c);
      else groups.push({ start: c.drawDate!, items: [c] });
    }
    for (const c of list.filter((x) => !x.drawDate)) {
      const g = c.drawNumber === null ? undefined : groups.find((x) => x.items.some((i) => i.drawNumber === c.drawNumber && !i.kind.startsWith("legacy")));
      if (g) g.items.push(c);
      else rejected.push({ denominationCode: code, candidates: [c] });
    }
    for (const g of groups) {
      const cluster = { denominationCode: code, candidates: g.items };
      if (g.items.some((c) => !c.kind.startsWith("legacy"))) clusters.push(cluster);
      else rejected.push(cluster);
    }
  }
  return { clusters, rejected };
}
