import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * The pre-rebuild `winners` table, renamed by migration 0000 and kept verbatim
 * (no data loss). It is one input of the bond backfill (source `legacy_db_snapshot`)
 * and is dropped only after docs/COVERAGE.md proves parity. Index names are the
 * ones created on the production database, which survive the rename.
 */
export const legacyWinners = pgTable(
  "legacy_winners",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    denomination: integer("denomination").notNull(),
    drawNumber: integer("draw_number"),
    drawDate: text("draw_date").notNull(),
    drawYear: text("draw_year"),
    city: text("city"),
    bondNumber: text("bond_number").notNull(),
    prizePosition: text("prize_position").notNull(),
    prizeAmount: integer("prize_amount").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_source_denom_date_bond").on(
      table.source,
      table.denomination,
      table.drawDate,
      table.bondNumber,
    ),
    index("idx_bond_number").on(table.bondNumber),
    index("idx_denomination").on(table.denomination),
    index("idx_draw_date").on(table.drawDate),
    index("idx_draw_number").on(table.drawNumber),
  ],
);
