import type { DenominationCode } from "@bondcheck/shared";

export type Tier = 1 | 2 | 3;
export const TIERS: readonly Tier[] = [1, 2, 3];

/** `source_documents.source` values written by this lane (PLAN section 3.1). */
export type DocumentSource =
  | "savings_gov_pk"
  | "savings_gov_pk_legacy"
  | "prizeinfo_net"
  | "legacy_db_snapshot"
  | "manual";

/**
 * Independent origins. Two candidates only corroborate each other when their families differ:
 * the legacy rows scraped from prizeinfo.net are not independent of the prizeinfo.net record page.
 */
export type SourceFamily = "official" | "pkprizebond" | "prizeinfo" | "manual";

export type CandidateKind =
  | "official_txt"
  | "official_pdf"
  | "official_spot"
  | "official_catalog"
  | "prizeinfo_schedule"
  | "legacy_pkprizebond"
  | "legacy_prizeinfo"
  | "prizeinfo_record"
  | "manual";

/** Reconciliation precedence (lower wins): official TXT > official PDF > legacy snapshot > prizeinfo.net. */
export const KIND_PRECEDENCE: Record<CandidateKind, number> = {
  official_txt: 0,
  official_pdf: 1,
  official_spot: 2,
  official_catalog: 2,
  manual: 3,
  legacy_pkprizebond: 4,
  legacy_prizeinfo: 5,
  prizeinfo_record: 6,
  prizeinfo_schedule: 7,
};

export const KIND_FAMILY: Record<CandidateKind, SourceFamily> = {
  official_txt: "official",
  official_pdf: "official",
  official_spot: "official",
  official_catalog: "official",
  manual: "manual",
  legacy_pkprizebond: "pkprizebond",
  legacy_prizeinfo: "prizeinfo",
  prizeinfo_record: "prizeinfo",
  prizeinfo_schedule: "prizeinfo",
};

export interface TierHeader {
  /** Prize amount per winning number as printed in the document, in rupees. */
  amountPkr: number | null;
  /** Winning numbers per series as printed in the document. */
  count: number | null;
}

/** Output of the official result parser (TXT, or text extracted from a PDF). */
export interface ParsedResultDocument {
  header: {
    faceValue: number | null;
    premium: boolean;
    drawNumber: number | null;
    drawDate: string | null;
    city: string | null;
  };
  tiers: Record<Tier, { header: TierHeader; numbers: number[] }>;
  /** Non fatal oddities, for example a third prize count that equals the total of all tiers. */
  warnings: string[];
}

/** A single source's view of one draw, ready for validation and reconciliation. */
export interface Candidate {
  kind: CandidateKind;
  /** `source_documents.sha256` the candidate was parsed from. */
  documentSha256: string;
  parserVersion: string;
  denominationCode: DenominationCode;
  drawDate: string | null;
  drawNumber: number | null;
  city: string | null;
  /** Tiers this source provides. A missing key means "not provided", not "no winners". */
  tiers: Partial<Record<Tier, number[]>>;
  prizes: Partial<Record<Tier, TierHeader>>;
  /** Official spot checks: numbers confirmed or denied as winners of a given tier. */
  spot?: { number: number; won: boolean; tier: Tier | null; amountPkr: number | null }[];
  notes?: string[];
}

export interface IssueInput {
  severity: "info" | "warn" | "error";
  message: string;
  details?: unknown;
}
