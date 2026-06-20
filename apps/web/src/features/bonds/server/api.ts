import "server-only";
import type { NextResponse } from "next/server";
import type { z } from "zod";
import {
  formatBondNumber,
  type DrawDetail,
  type DrawSummary,
  type Denomination,
} from "@bondcheck/shared";
import type { CoverageRow, DenominationRow, DrawDetailView, DrawRow } from "@bondcheck/db/queries/bonds";
import { errorResponse, jsonResponse } from "@/server/http";
import { codeFromSlug } from "../labels";
import { DataUnavailableError } from "./repo";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toDenomination(row: DenominationRow): Denomination {
  return {
    code: row.code,
    faceValue: row.faceValue,
    kind: row.kind as Denomination["kind"],
    status: row.status as Denomination["status"],
    introducedOn: row.introducedOn,
    discontinuedOn: row.discontinuedOn,
    encashmentDeadline: row.encashmentDeadline,
    drawsPerYear: row.drawsPerYear,
    notesEn: row.notesEn,
    notesUr: row.notesUr,
  };
}

export function toDrawSummary(row: DrawRow): DrawSummary {
  return {
    id: row.id,
    denominationCode: row.denominationCode,
    drawNumber: row.drawNumber,
    drawDate: row.drawDate,
    city: row.city,
    status: row.status as DrawSummary["status"],
    completeness: row.completeness as DrawSummary["completeness"],
    resultChecksum: row.resultChecksum,
    publishedAt: iso(row.publishedAt),
    verifiedAt: iso(row.verifiedAt),
  };
}

/** Shown on disputed draws (API consumers localise their own copy; the web page uses messages). */
export const DISPUTED_NOTICE =
  "Sources disagree on this draw. The numbers shown follow the most authoritative source; the conflicting sources are listed. Check with National Savings before claiming a prize.";

export function toDrawDetail(view: DrawDetailView): DrawDetail {
  return {
    ...toDrawSummary(view.draw),
    prizes: view.prizes.map((p) => ({ tier: p.tier, amountPkr: p.amountPkr, winnersCount: p.winnersCount, inferred: p.inferred })),
    tier1: view.tier1.map(formatBondNumber),
    tier2: view.tier2.map(formatBondNumber),
    sources: view.sources.map((s) => ({
      source: s.source,
      url: s.url,
      sha256: s.sha256,
      fetchedAt: s.fetchedAt.toISOString(),
      role: s.role,
      parsedCount: s.parsedCount,
    })),
    notice: view.draw.status === "disputed" ? DISPUTED_NOTICE : null,
  };
}

export function toCoverageRow(row: CoverageRow) {
  return row;
}

/** Cache profiles in seconds (PLAN section 6: public GETs are CDN cacheable). */
export const CACHE = {
  reference: { sMaxAge: 3600, staleWhileRevalidate: 86_400 },
  list: { sMaxAge: 300, staleWhileRevalidate: 3600 },
  verified: { sMaxAge: 86_400, staleWhileRevalidate: 604_800 },
} as const;

export const drawCache = (status: string) => (status === "verified" ? CACHE.verified : CACHE.list);

/** Parses input with a contract schema; a 400 response with the first issue otherwise. */
export function parseInput<S extends z.ZodType>(
  schema: S | undefined,
  input: unknown,
): { ok: true; value: z.infer<S> } | { ok: false; response: NextResponse } {
  if (!schema) throw new Error("endpoint has no schema for this input");
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const first = result.error.issues[0];
  const where = first?.path.length ? `${first.path.join(".")}: ` : "";
  return { ok: false, response: errorResponse("bad_request", `${where}${first?.message ?? "invalid input"}`) };
}

export function searchParamsObject(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

/** Accepts both the code ("40000P") and the page slug ("premium-40000"). */
export function denominationParam(value: string): string | null {
  return codeFromSlug(value);
}

/** Maps data layer failures to a safe 503; everything else to a generic 500. */
export function failure(error: unknown): NextResponse {
  if (error instanceof DataUnavailableError) {
    return errorResponse("unavailable", "Prize bond data is temporarily unavailable. Please try again shortly.");
  }
  console.error("bonds api error", error instanceof Error ? error.name : "unknown");
  return errorResponse("internal", "Something went wrong.");
}

export { jsonResponse, errorResponse };
