import { and, between, eq } from "drizzle-orm";
import { draws, drawSources, sourceDocuments, type Db } from "@bondcheck/db";
import { coverageRows, type CoverageRow } from "@bondcheck/db/queries/bonds";
import { addDays } from "./dates";

/**
 * Draws named in docs/DATA_AUDIT.md section 3: 17 draws with more than one distinct first prize
 * in the legacy table (items 3) and the 4 cross-source first prize conflicts (item 4, three of
 * which are also in the first list). Each must end up resolved or disputed.
 */
export const AUDIT_DRAWS: readonly { code: string; date: string; finding: string }[] = [
  { code: "100", date: "2025-08-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "100", date: "2026-02-16", finding: "two first prizes (scraper artefact 003542)" },
  { code: "200", date: "2003-12-15", finding: "two first prizes in the pkprizebond list" },
  { code: "200", date: "2023-12-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "200", date: "2024-03-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "750", date: "2024-01-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "750", date: "2025-01-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "750", date: "2026-01-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "1500", date: "2025-08-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "1500", date: "2024-02-15", finding: "two first prizes (scraper artefact 003542)" },
  { code: "1500", date: "2010-11-15", finding: "sources disagree on the first prize (209637 vs 397799)" },
  { code: "1500", date: "2026-02-16", finding: "two first prizes (scraper artefact 003542)" },
  { code: "1500", date: "2014-02-17", finding: "two first prizes in the pkprizebond list" },
  { code: "40000", date: "2016-03-01", finding: "sources disagree on the first prize (592635 vs 190031)" },
  { code: "40000", date: "2017-03-01", finding: "sources disagree on the first prize (669572 vs 035150)" },
  { code: "40000", date: "2014-09-01", finding: "two first prizes in the pkprizebond list" },
  { code: "40000", date: "2013-09-02", finding: "sources disagree on the first prize (370987 vs 370978)" },
];

export interface AuditResolution {
  code: string;
  date: string;
  finding: string;
  status: string;
  completeness: string;
  primary: string | null;
}

export async function auditResolutions(db: Db): Promise<AuditResolution[]> {
  const out: AuditResolution[] = [];
  for (const a of AUDIT_DRAWS) {
    const [row] = await db
      .select()
      .from(draws)
      .where(and(eq(draws.denominationCode, a.code), between(draws.drawDate, addDays(a.date, -10), addDays(a.date, 10))));
    let primary: string | null = null;
    if (row) {
      const [p] = await db
        .select({ source: sourceDocuments.source, url: sourceDocuments.url })
        .from(drawSources)
        .innerJoin(sourceDocuments, eq(sourceDocuments.sha256, drawSources.documentSha256))
        .where(and(eq(drawSources.drawId, row.id), eq(drawSources.role, "primary")));
      primary = p ? describeSource(p.source, p.url) : null;
    }
    out.push({ ...a, status: row?.status ?? "not in database", completeness: row?.completeness ?? "none", primary });
  }
  return out;
}

function describeSource(source: string, url: string): string {
  if (source === "savings_gov_pk") return url.endsWith(".pdf") ? "official PDF" : "official TXT";
  if (source === "savings_gov_pk_legacy") return url.includes("results.php") ? "official number search" : "official date list";
  if (source === "prizeinfo_net") return "prizeinfo.net record";
  if (source === "legacy_db_snapshot") return url.includes("prizeinfo_net") ? "legacy snapshot (prizeinfo.net rows)" : "legacy snapshot (pkprizebond.com rows)";
  return source;
}

const LABEL: Record<string, string> = {
  "100": "Rs 100",
  "200": "Rs 200",
  "750": "Rs 750",
  "1500": "Rs 1,500",
  "7500": "Rs 7,500",
  "15000": "Rs 15,000",
  "25000": "Rs 25,000",
  "40000": "Rs 40,000",
  "25000P": "Rs 25,000 Premium",
  "40000P": "Rs 40,000 Premium",
};

/** docs/COVERAGE.md: summary, per year matrix, audit resolutions and method. No em dashes. */
export function renderCoverageMarkdown(rows: CoverageRow[], audit: AuditResolution[], meta: { generatedOn: string; note?: string }): string {
  const codes = [...new Set(rows.map((r) => r.denominationCode))];
  const lines: string[] = [];
  lines.push("# Prize bond coverage report", "");
  lines.push(`Generated on ${meta.generatedOn} by \`pnpm --filter @bondcheck/ingest coverage:bonds\` from the \`draws\`, \`draw_sources\` and \`source_documents\` tables. The same numbers are served by \`GET /api/v1/bonds/coverage\` and the /prize-bonds/coverage page.`, "");
  if (meta.note) lines.push(meta.note, "");
  lines.push(
    "Legend: **expected** draws held in the year (catalogued draws, and at least the denomination's draws per year between its first and last year); **full** first, second and third prize lists; **top** first and second prizes only; **none** nothing published; **verified** two independent sources agree on the top prizes, or an official file for draws since 2019; **disputed** valid sources disagree (the draw page lists them).",
    "",
  );

  lines.push("## Summary", "", "| Denomination | Years | Expected | Full | Top | None | Verified | Disputed |", "|---|---|---:|---:|---:|---:|---:|---:|");
  for (const code of codes) {
    const mine = rows.filter((r) => r.denominationCode === code);
    const active = mine.filter((r) => r.expected > 0);
    const sum = (k: "expected" | "full" | "top" | "none" | "verified" | "disputed") => mine.reduce((a, r) => a + r[k], 0);
    const span = active.length ? `${active[0]!.year} to ${active[active.length - 1]!.year}` : "no draws found";
    lines.push(`| ${LABEL[code] ?? code} | ${span} | ${sum("expected")} | ${sum("full")} | ${sum("top")} | ${sum("none")} | ${sum("verified")} | ${sum("disputed")} |`);
  }
  lines.push("");

  lines.push("## Per year", "", "Each cell is `full/top/none` of expected draws; `-` means no draw expected that year.", "");
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  lines.push(`| Year | ${codes.map((c) => LABEL[c] ?? c).join(" | ")} |`, `|---|${codes.map(() => "---").join("|")}|`);
  for (const y of years) {
    const cells = codes.map((c) => {
      const r = rows.find((x) => x.denominationCode === c && x.year === y);
      return r && r.expected > 0 ? `${r.full}/${r.top}/${r.none}` : "-";
    });
    lines.push(`| ${y}${y === 1999 ? " (no source)" : ""} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  lines.push("## Data audit findings", "", "Draws named in docs/DATA_AUDIT.md section 3 (multiple first prizes and cross-source conflicts) and how they ended up.", "");
  lines.push("| Denomination | Draw date | Finding | Status | Completeness | Primary source |", "|---|---|---|---|---|---|");
  for (const a of audit) lines.push(`| ${LABEL[a.code] ?? a.code} | ${a.date} | ${a.finding} | ${a.status} | ${a.completeness} | ${a.primary ?? "none"} |`);
  lines.push("");

  lines.push(
    "## Method",
    "",
    "1. Sources, in precedence order: official National Savings result files (TXT, then PDF text), the official draw date list and number search (www.savings.gov.pk/latest/results.php), the legacy database snapshot of pkprizebond.com and prizeinfo.net rows, and the prizeinfo.net first and second prize records and schedules. Every document is stored with its URL, fetch time and sha256 and linked to the draws it supports.",
    "2. Parsers locate prize sections by their headings; numbers in prose, headers and amounts are never collected. Prize amounts and counts are read from each document; the reference prize table is used only when a document states none, and such amounts are marked as inferred.",
    "3. Validation: six digit numbers, no duplicates, one tier per number, and tier counts equal to the document header or the reference (1, 3 and 1696 for most bearer bonds, 1, 5 and 2394 for Rs 200, 1, 3 and 1199 for Rs 100, 2, 5 and 700 for Premium 25000, 1, 3 and 660 for Premium 40000). A list that fails is not published.",
    "4. Legacy snapshot cleaning: both date spellings are normalised; Premium 25000 and 40000 draws stored under the bearer codes are split by date; 25 numbers repeated in about 525 pkprizebond.com lists and `003542` repeated as a first prize by the prizeinfo.net scraper are removed as artefacts (a real number wins at most a handful of times in 25 years). After cleaning, the pkprizebond.com lists match the official files exactly wherever both exist.",
    "5. Draws are matched across sources by denomination and date within 10 days (sources disagree by a few days, for example 01-Dec-2017 against 04-Dec-2017). A date found only in the legacy snapshot, with no official or prizeinfo.net record, is rejected as a mislabelled list.",
    "6. When valid sources disagree on the first prize, the official number search is asked about each disputed number. The 1999 draws and the Rs 100 draws before February 2013 have no machine readable source; they are listed as `no source` until newspaper archives are entered by hand.",
    "7. The legacy `draw_schedule` table is not imported: its draw numbers disagree with the official files (for example the Rs 100 draw of 15 May 2026 is draw 54 in the official file and 48 in that table). The calendar comes from the official date lists and the prizeinfo.net schedules instead.",
    "",
    "Third-party data is used to fill gaps and to corroborate, with attribution: pkprizebond.com (through the legacy snapshot only; the site is not scraped) and prizeinfo.net.",
    "",
  );
  return lines.join("\n");
}

export async function buildCoverageMarkdown(db: Db, today: string, note?: string): Promise<string> {
  return renderCoverageMarkdown(await coverageRows(db, today), await auditResolutions(db), { generatedOn: today, note });
}
