import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { denominations, draws } from "./bonds";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Anonymous identity, see ADR 0004. Only hashes of client secrets are stored. */
export const wallets = pgTable("wallets", {
  /** UUIDv7 */
  id: uuid("id").primaryKey(),
  /** HMAC-SHA256 (key WALLET_PEPPER) of the 32 byte secret held by the client */
  tokenHash: text("token_hash").notNull(),
  /** HMAC of the current human sync code, rotatable */
  syncCodeHash: text("sync_code_hash").unique(),
  locale: text("locale"),
  timezone: text("timezone"),
  createdAt: ts("created_at").defaultNow().notNull(),
  lastSeenAt: ts("last_seen_at").defaultNow().notNull(),
  /** future sign-in link */
  userId: text("user_id"),
});

export const walletBonds = pgTable(
  "wallet_bonds",
  {
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    denominationCode: text("denomination_code")
      .notNull()
      .references(() => denominations.code),
    bondNumber: integer("bond_number").notNull(),
    label: text("label"),
    addedAt: ts("added_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.walletId, t.denominationCode, t.bondNumber] })],
);

export const walletMatches = pgTable(
  "wallet_matches",
  {
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    drawId: integer("draw_id")
      .notNull()
      .references(() => draws.id),
    bondNumber: integer("bond_number").notNull(),
    tier: smallint("tier").notNull(),
    amountPkr: bigint("amount_pkr", { mode: "number" }).notNull(),
    matchedAt: ts("matched_at").defaultNow().notNull(),
    notifiedAt: ts("notified_at"),
    seenAt: ts("seen_at"),
  },
  (t) => [
    primaryKey({ columns: [t.walletId, t.drawId, t.bondNumber] }),
    index("idx_wallet_matches_draw").on(t.drawId),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    /** 'webpush' | 'expo' */
    platform: text("platform").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    keys: jsonb("keys"),
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_push_wallet").on(t.walletId)],
);
