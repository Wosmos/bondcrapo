import { pgTable, serial, text, integer, timestamp, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";

export const winners = pgTable(
  "winners",
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
      table.bondNumber
    ),
    index("idx_bond_number").on(table.bondNumber),
    index("idx_denomination").on(table.denomination),
    index("idx_draw_date").on(table.drawDate),
    index("idx_draw_number").on(table.drawNumber),
  ]
);

// ── Anonymous Device Identity ──────────────────────────────
export const devices = pgTable(
  "devices",
  {
    id: serial("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    firstSeen: timestamp("first_seen").defaultNow(),
    lastSeen: timestamp("last_seen").defaultNow(),
    totalSessions: integer("total_sessions").default(1),
    // Collected device metadata
    os: text("os"),
    browser: text("browser"),
    deviceType: text("device_type"), // mobile / tablet / desktop
    screenRes: text("screen_res"),
    language: text("language"),
    timezone: text("timezone"),
    country: text("country"),
    city: text("city"),
    rawMeta: jsonb("raw_meta"), // full metadata dump
  },
  (table) => [
    uniqueIndex("uq_device_fingerprint").on(table.fingerprint),
  ]
);

// ── Wallet: saved bonds per device ─────────────────────────
export const walletBonds = pgTable(
  "wallet_bonds",
  {
    id: serial("id").primaryKey(),
    deviceFingerprint: text("device_fingerprint").notNull(),
    bondNumber: text("bond_number").notNull(),
    label: text("label"),
    denomination: integer("denomination"),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_device_bond").on(table.deviceFingerprint, table.bondNumber),
    index("idx_wallet_device").on(table.deviceFingerprint),
  ]
);

// ── Wallet Notifications (auto-check results) ────────────
export const walletNotifications = pgTable(
  "wallet_notifications",
  {
    id: serial("id").primaryKey(),
    deviceFingerprint: text("device_fingerprint").notNull(),
    bondNumber: text("bond_number").notNull(),
    winnerId: integer("winner_id").notNull(),
    denomination: integer("denomination").notNull(),
    prizePosition: text("prize_position").notNull(),
    prizeAmount: integer("prize_amount").notNull(),
    drawDate: text("draw_date").notNull(),
    seen: integer("seen").default(0), // 0 = unseen, 1 = seen
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_notif_device_winner").on(table.deviceFingerprint, table.winnerId),
    index("idx_notif_device").on(table.deviceFingerprint),
    index("idx_notif_unseen").on(table.deviceFingerprint, table.seen),
  ]
);

// ── Event Tracking / Analytics ─────────────────────────────
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    deviceFingerprint: text("device_fingerprint").notNull(),
    sessionId: text("session_id").notNull(),
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data"),
    page: text("page"),
    referrer: text("referrer"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    screenWidth: integer("screen_width"),
    screenHeight: integer("screen_height"),
    language: text("language"),
    timezone: text("timezone"),
    connectionType: text("connection_type"),
    batteryLevel: text("battery_level"),
    lat: text("lat"),
    lng: text("lng"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_events_device").on(table.deviceFingerprint),
    index("idx_events_session").on(table.sessionId),
    index("idx_events_type").on(table.eventType),
    index("idx_events_created").on(table.createdAt),
  ]
);
