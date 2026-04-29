import { sql } from "drizzle-orm";
import type { Db } from "@bondcheck/db";
import { DENOMINATION_CODES, type DenominationCode } from "@bondcheck/shared";
import { parseLooseDate } from "./dates";
import { findCity } from "./parse-result-text";
import type { Candidate, Tier } from "./types";

export const LEGACY_PARSER_VERSION = "legacy-snapshot@1";
const BODY_MAGIC = "# bondcheck legacy snapshot candidate v1";

export type LegacyOrigin = "pkprizebond_com" | "prizeinfo_net";

export interface LegacyRow {
  source: string;
  denomination: number;
  drawNumber: number | null;
  drawDate: string;
  city: string | null;
  bondNumber: string;
  prizePosition: string;
}

/** One draw as the legacy snapshot holds it, cleaned and ready to be stored as a document. */
export interface LegacyDraft {
  origin: LegacyOrigin;
  denominationCode: DenominationCode;
  drawDate: string;
  drawNumber: number | null;
  city: string | null;
  tiers: Record<Tier, number[]>;
  removedArtefacts: number[];
  notes: string[];
}

const POSITION_TIER: Record<string, Tier> = { "1st": 1, "2nd": 2, "3rd": 3 };

/**
 * The legacy table stores Premium 25000/40000 draws under the bearer codes. Premium draws fall on
 * the 10th to 12th of March, June, September and December (official date lists, ids 9 and 10);
 * bearer draws fell on the 1st to 5th (or the last days of February). The premium bonds started in
 * June 2017 (40000P) and March 2021 (25000P).
 */
export function legacyDenominationCode(denomination: number, isoDate: string): DenominationCode | null {
  const day = Number(isoDate.slice(8, 10));
  const premiumDay = day >= 9 && day <= 13;
  if (denomination === 40000 && premiumDay && isoDate >= "2017-06-01") return "40000P";
  if (denomination === 25000 && premiumDay && isoDate >= "2021-03-01") return "25000P";
  const code = String(denomination);
  return (DENOMINATION_CODES as readonly string[]).includes(code) ? (code as DenominationCode) : null;
}

/**
 * Numbers that cannot be real results: a scraped page block repeated into every list. A number
 * wins at most a handful of times in 25 years (the busiest real number in the snapshot appears in
 * 8 draws); anything in more than 8 draws, or listed as a first prize in 3 or more draws, is an
 * artefact of the old scraper (for example 25 numbers repeated in about 525 pkprizebond.com
 * lists, and `003542` repeated as a first prize by the prizeinfo.net scraper).
 */
export async function findLegacyArtefacts(db: Db, table: string): Promise<Map<string, Set<number>>> {
  const t = sql.identifier(table);
  const res = await db.execute(sql`
    select source, bond_number from ${t}
      group by source, bond_number having count(distinct (denomination, draw_date)) > 8
    union
    select source, bond_number from ${t} where prize_position = '1st'
      group by source, bond_number having count(distinct (denomination, draw_date)) >= 3`);
  const out = new Map<string, Set<number>>();
  for (const row of rowsOf<{ source: string; bond_number: string }>(res)) {
    const set = out.get(row.source) ?? new Set<number>();
    set.add(Number(row.bond_number));
    out.set(row.source, set);
  }
  return out;
}

/** Table holding the snapshot: `legacy_winners` after migration 0000, `winners` before it. */
export async function legacyTableName(db: Db): Promise<string | null> {
  const res = await db.execute(
    sql`select coalesce(to_regclass('public.legacy_winners')::text, to_regclass('public.winners')::text) as name`,
  );
  const name = rowsOf<{ name: string | null }>(res)[0]?.name ?? null;
  return name ? name.replace(/^public\./, "").replace(/"/g, "") : null;
}

export async function legacyGroups(db: Db, table: string): Promise<{ source: string; denomination: number }[]> {
  const res = await db.execute(
    sql`select distinct source, denomination from ${sql.identifier(table)} order by source, denomination`,
  );
  return rowsOf<{ source: string; denomination: number }>(res).map((r) => ({
    source: r.source,
    denomination: Number(r.denomination),
  }));
}

export async function readLegacyRows(db: Db, table: string, source: string, denomination: number): Promise<LegacyRow[]> {
  const res = await db.execute(sql`
    select source, denomination, draw_number, draw_date, city, bond_number, prize_position
      from ${sql.identifier(table)} where source = ${source} and denomination = ${denomination} order by id`);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    source: String(r.source),
    denomination: Number(r.denomination),
    drawNumber: r.draw_number === null || r.draw_number === undefined ? null : Number(r.draw_number),
    drawDate: String(r.draw_date),
    city: r.city === null || r.city === undefined ? null : String(r.city),
    bondNumber: String(r.bond_number),
    prizePosition: String(r.prize_position),
  }));
}

function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * Groups snapshot rows into one draft per (origin, denomination, normalised date). Both date
 * spellings collapse into one date; duplicate numbers are dropped; a number listed in two tiers is
 * kept in the higher tier only; artefacts are removed. Every change is noted in the draft.
 */
export function buildLegacyDrafts(rows: readonly LegacyRow[], artefacts: Map<string, Set<number>>): LegacyDraft[] {
  const drafts = new Map<string, LegacyDraft & { seen: Map<number, Tier>; numbers: Map<number, string[]>; cities: string[] }>();
  for (const r of rows) {
    if (r.source !== "pkprizebond_com" && r.source !== "prizeinfo_net") continue;
    const iso = parseLooseDate(r.drawDate);
    const tier = POSITION_TIER[r.prizePosition];
    if (!iso || !tier || !/^\d{6}$/.test(r.bondNumber.trim())) continue;
    const code = legacyDenominationCode(r.denomination, iso);
    if (!code) continue;
    const key = `${r.source}|${code}|${iso}`;
    let d = drafts.get(key);
    if (!d) {
      d = {
        origin: r.source,
        denominationCode: code,
        drawDate: iso,
        drawNumber: null,
        city: null,
        tiers: { 1: [], 2: [], 3: [] },
        removedArtefacts: [],
        notes: [],
        seen: new Map(),
        numbers: new Map(),
        cities: [],
      };
      drafts.set(key, d);
    }
    if (r.drawNumber !== null && r.drawNumber > 0) d.numbers.set(r.drawNumber, [...(d.numbers.get(r.drawNumber) ?? []), r.drawDate]);
    if (r.city) d.cities.push(r.city);
    const n = Number(r.bondNumber);
    if (n === 0) continue;
    if (artefacts.get(r.source)?.has(n)) {
      if (!d.removedArtefacts.includes(n)) d.removedArtefacts.push(n);
      continue;
    }
    const prev = d.seen.get(n);
    if (prev === undefined) d.seen.set(n, tier);
    else if (tier < prev) {
      d.seen.set(n, tier);
      d.notes.push(`${String(n).padStart(6, "0")} listed in tiers ${tier} and ${prev}; kept in tier ${tier}`);
    } else if (tier > prev) {
      d.notes.push(`${String(n).padStart(6, "0")} listed in tiers ${prev} and ${tier}; kept in tier ${prev}`);
    }
  }

  const out: LegacyDraft[] = [];
  for (const d of drafts.values()) {
    for (const [n, tier] of d.seen) d.tiers[tier].push(n);
    for (const t of [1, 2, 3] as const) d.tiers[t].sort((a, b) => a - b);
    // Most frequent draw number and city within the draft (rows disagree in a few draws).
    const numbers = [...d.numbers.entries()].sort((a, b) => b[1].length - a[1].length);
    d.drawNumber = numbers[0]?.[0] ?? null;
    if (numbers.length > 1) d.notes.push(`rows carry draw numbers ${numbers.map(([n]) => n).join(", ")}`);
    const cityCounts = new Map<string, number>();
    for (const c of d.cities) {
      const city = findCity(c);
      if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    }
    d.city = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    d.removedArtefacts.sort((a, b) => a - b);
    const { seen: _seen, numbers: _numbers, cities: _cities, ...draft } = d;
    // A draft left without numbers (only artefacts) says nothing about the draw.
    if (draft.tiers[1].length + draft.tiers[2].length + draft.tiers[3].length > 0) out.push(draft);
  }
  return out.sort((a, b) =>
    a.denominationCode === b.denominationCode
      ? a.drawDate.localeCompare(b.drawDate) || a.origin.localeCompare(b.origin)
      : a.denominationCode.localeCompare(b.denominationCode),
  );
}

export function legacyDocumentUrl(d: Pick<LegacyDraft, "origin" | "denominationCode" | "drawDate">): string {
  return `legacy-db://legacy_winners?source=${d.origin}&denomination=${d.denominationCode}&date=${d.drawDate}`;
}

const fmt = (n: number) => String(n).padStart(6, "0");

/** Deterministic body for `source_documents`: same snapshot rows always give the same sha256. */
export function legacyDocumentBody(d: LegacyDraft): string {
  const lines = [
    BODY_MAGIC,
    `# origin: ${d.origin}`,
    `# denomination: ${d.denominationCode}`,
    `# draw_date: ${d.drawDate}`,
    `# draw_number: ${d.drawNumber ?? ""}`,
    `# city: ${d.city ?? ""}`,
    `# removed_artefacts: ${d.removedArtefacts.map(fmt).join(",")}`,
    ...d.notes.map((n) => `# note: ${n}`),
  ];
  for (const t of [1, 2, 3] as const) for (const n of d.tiers[t]) lines.push(`${t}:${fmt(n)}`);
  return `${lines.join("\n")}\n`;
}

export function isLegacyBody(body: string): boolean {
  return body.startsWith(BODY_MAGIC);
}

/** Parses a stored legacy document back into a candidate. */
export function legacyCandidate(body: string, sha256: string): Candidate | null {
  if (!isLegacyBody(body)) return null;
  const meta: Record<string, string> = {};
  const tiers: Record<Tier, number[]> = { 1: [], 2: [], 3: [] };
  const notes: string[] = [];
  for (const line of body.split("\n")) {
    const m = /^# ([a-z_]+): ?(.*)$/.exec(line);
    if (m) {
      if (m[1] === "note") notes.push(m[2]!);
      else meta[m[1]!] = m[2]!;
      continue;
    }
    const r = /^([123]):(\d{6})$/.exec(line);
    if (r) tiers[Number(r[1]) as Tier].push(Number(r[2]));
  }
  const code = meta.denomination as DenominationCode;
  if (!(DENOMINATION_CODES as readonly string[]).includes(code) || !meta.draw_date) return null;
  const provided: Candidate["tiers"] = {};
  for (const t of [1, 2, 3] as const) if (tiers[t].length > 0) provided[t] = tiers[t];
  return {
    kind: meta.origin === "prizeinfo_net" ? "legacy_prizeinfo" : "legacy_pkprizebond",
    documentSha256: sha256,
    parserVersion: LEGACY_PARSER_VERSION,
    denominationCode: code,
    drawDate: meta.draw_date,
    drawNumber: meta.draw_number ? Number(meta.draw_number) : null,
    city: meta.city || null,
    tiers: provided,
    prizes: {},
    notes: [
      ...(meta.removed_artefacts ? [`removed scraper artefacts: ${meta.removed_artefacts}`] : []),
      ...notes,
    ],
  };
}
