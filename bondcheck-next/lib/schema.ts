import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const winners = pgTable(
  "winners",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    denomination: integer("denomination").notNull(),
    drawDate: text("draw_date").notNull(),
    drawYear: text("draw_year"),
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
      table.bondNumber
    ),
    index("idx_bond_number").on(table.bondNumber),
    index("idx_denomination").on(table.denomination),
    index("idx_draw_date").on(table.drawDate),
  ]
);
