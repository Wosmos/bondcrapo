import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** One row per instrument. Bearer and premium registered bonds are distinct codes. */
export const denominations = pgTable("denominations", {
  /** '100','200','750','1500','7500','15000','25000','40000','25000P','40000P', ... */
  code: text("code").primaryKey(),
  faceValue: integer("face_value").notNull(),
  /** 'bearer' | 'premium_registered' */
  kind: text("kind").notNull(),
  /** 'active' | 'discontinued' */
  status: text("status").notNull(),
  introducedOn: date("introduced_on"),
  discontinuedOn: date("discontinued_on"),
  encashmentDeadline: date("encashment_deadline"),
  drawsPerYear: smallint("draws_per_year"),
  notesEn: text("notes_en"),
  notesUr: text("notes_ur"),
});

/** Reference prize tables, used for validation and for draws whose file lacks amounts. */
export const prizeStructures = pgTable(
  "prize_structures",
  {
    id: serial("id").primaryKey(),
    denominationCode: text("denomination_code")
      .notNull()
      .references(() => denominations.code),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    tier: smallint("tier").notNull(),
    amountPkr: bigint("amount_pkr", { mode: "number" }).notNull(),
    winnersCount: integer("winners_count").notNull(),
    sourceUrl: text("source_url").notNull(),
  },
  (t) => [unique("uq_prize_structure").on(t.denominationCode, t.effectiveFrom, t.tier)],
);

export const draws = pgTable(
  "draws",
  {
    id: serial("id").primaryKey(),
    denominationCode: text("denomination_code")
      .notNull()
      .references(() => denominations.code),
    /** null allowed only until reconciled */
    drawNumber: integer("draw_number"),
    drawDate: date("draw_date").notNull(),
    city: text("city"),
    /** 'scheduled' | 'published' | 'verified' | 'disputed' */
    status: text("status").notNull(),
    /** 'none' | 'top' (1st and 2nd only) | 'full' */
    completeness: text("completeness").notNull().default("none"),
    /** sha256 of the canonical sorted "tier:number\n" list */
    resultChecksum: text("result_checksum"),
    publishedAt: ts("published_at"),
    verifiedAt: ts("verified_at"),
    updatedAt: ts("updated_at").defaultNow(),
  },
  (t) => [
    unique("uq_draw_denomination_date").on(t.denominationCode, t.drawDate),
    uniqueIndex("uq_draw_denomination_number")
      .on(t.denominationCode, t.drawNumber)
      .where(sql`${t.drawNumber} is not null`),
    index("idx_draws_date").on(t.drawDate),
  ],
);

/** Per-draw prize table, parsed from the result document header. */
export const drawPrizes = pgTable(
  "draw_prizes",
  {
    drawId: integer("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    tier: smallint("tier").notNull(),
    amountPkr: bigint("amount_pkr", { mode: "number" }).notNull(),
    winnersCount: integer("winners_count").notNull(),
    /** true when taken from prize_structures because the document had no header */
    inferred: smallint("inferred").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.drawId, t.tier] })],
);

/** The big table (about 1.5M rows). bondNumber is 0..999999, always rendered left padded to 6. */
export const drawResults = pgTable(
  "draw_results",
  {
    drawId: integer("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    bondNumber: integer("bond_number").notNull(),
    tier: smallint("tier").notNull(),
  },
  (t) => [primaryKey({ columns: [t.drawId, t.bondNumber] }), index("idx_draw_results_bond").on(t.bondNumber)],
);

/** Raw fetched files, content addressed. */
export const sourceDocuments = pgTable("source_documents", {
  sha256: text("sha256").primaryKey(),
  /** 'savings_gov_pk' | 'savings_gov_pk_legacy' | 'pkprizebond_com' | 'prizeinfo_net' | 'legacy_db_snapshot' | 'manual' */
  source: text("source").notNull(),
  url: text("url").notNull(),
  fetchedAt: ts("fetched_at").notNull(),
  contentType: text("content_type"),
  bytes: integer("bytes"),
  /** TXT/HTML as fetched (PDF stored as extracted text plus a flag) */
  body: text("body").notNull(),
});

/** Which documents contributed to a draw, and whether they agree. */
export const drawSources = pgTable(
  "draw_sources",
  {
    drawId: integer("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    documentSha256: text("document_sha256")
      .notNull()
      .references(() => sourceDocuments.sha256),
    parserVersion: text("parser_version").notNull(),
    parsedCount: integer("parsed_count").notNull(),
    /** checksum of what this document alone yields */
    checksum: text("checksum"),
    /** 'primary' | 'corroborating' | 'conflicting' */
    role: text("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.drawId, t.documentSha256] })],
);
