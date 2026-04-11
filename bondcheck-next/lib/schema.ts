import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  jsonb,
  numeric,
  date,
  boolean,
  bigint,
} from "drizzle-orm/pg-core";

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

// ── Gold Prices (time-series) ─────────────────────────────
export const goldPrices = pgTable(
  "gold_prices",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(), // 'goldpricez_api', 'local_sarafi'
    karat: text("karat").notNull(), // '24k', '22k', '21k'
    unit: text("unit").notNull(), // 'tola', 'gram', 'ounce'
    pricePkr: numeric("price_pkr", { precision: 12, scale: 2 }).notNull(),
    priceUsd: numeric("price_usd", { precision: 10, scale: 2 }),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_gold_snapshot").on(
      table.source,
      table.karat,
      table.unit,
      table.recordedAt
    ),
    index("idx_gold_recorded").on(table.recordedAt),
    index("idx_gold_karat_unit").on(table.karat, table.unit),
  ]
);

// ── Exchange Rates (time-series) ──────────────────────────
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: serial("id").primaryKey(),
    baseCurrency: text("base_currency").notNull(), // 'USD'
    quoteCurrency: text("quote_currency").notNull(), // 'PKR'
    rateType: text("rate_type").notNull(), // 'interbank', 'open_market'
    rate: numeric("rate", { precision: 12, scale: 4 }).notNull(),
    source: text("source").notNull(),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_fx_pair_time").on(
      table.baseCurrency,
      table.quoteCurrency,
      table.recordedAt
    ),
  ]
);

// ── National Savings Certificate Rates ────────────────────
export const savingsRates = pgTable(
  "savings_rates",
  {
    id: serial("id").primaryKey(),
    certificateType: text("certificate_type").notNull(), // 'bahbood', 'defence', 'special', etc.
    displayName: text("display_name").notNull(),
    ratePercent: numeric("rate_percent", { precision: 5, scale: 2 }).notNull(),
    effectiveDate: date("effective_date"),
    maturityPeriod: text("maturity_period"), // '10 years', '3 months', etc.
    minInvestment: integer("min_investment"),
    eligibility: text("eligibility"), // 'all', 'widows_seniors', 'pensioners'
    profitPayment: text("profit_payment"), // 'monthly', 'quarterly', 'maturity'
    source: text("source").notNull().default("savings_gov_pk"),
    scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_savings_rate").on(
      table.certificateType,
      table.ratePercent,
      table.effectiveDate
    ),
    index("idx_savings_type").on(table.certificateType),
  ]
);

// ── Prize Bond Draw Schedule ──────────────────────────────
export const drawSchedule = pgTable(
  "draw_schedule",
  {
    id: serial("id").primaryKey(),
    denomination: integer("denomination").notNull(),
    drawNumber: integer("draw_number"),
    drawDate: date("draw_date").notNull(),
    city: text("city"),
    status: text("status").notNull().default("scheduled"), // 'scheduled', 'completed', 'results_available'
    source: text("source").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_schedule_denom_date").on(
      table.denomination,
      table.drawDate
    ),
    index("idx_schedule_status").on(table.status),
    index("idx_schedule_date").on(table.drawDate),
  ]
);

// ── Price Alerts (user-configured) ────────────────────────
export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: serial("id").primaryKey(),
    deviceFingerprint: text("device_fingerprint").notNull(),
    alertType: text("alert_type").notNull(), // 'gold_above', 'gold_below', 'usd_above', 'usd_below', 'draw_reminder'
    targetValue: numeric("target_value", { precision: 16, scale: 2 }),
    params: jsonb("params"), // extra config (karat, currency pair, etc.)
    triggered: boolean("triggered").default(false),
    triggeredAt: timestamp("triggered_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_alerts_device").on(table.deviceFingerprint),
    index("idx_alerts_active").on(table.triggered, table.alertType),
  ]
);

// ── Analytics Daily Aggregates ────────────────────────────
export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    totalSessions: integer("total_sessions").default(0),
    uniqueDevices: integer("unique_devices").default(0),
    totalSearches: integer("total_searches").default(0),
    totalWalletChecks: integer("total_wallet_checks").default(0),
    totalBondScans: integer("total_bond_scans").default(0),
    topDenominations: jsonb("top_denominations"),
    deviceBreakdown: jsonb("device_breakdown"),
    browserBreakdown: jsonb("browser_breakdown"),
  },
  (table) => [uniqueIndex("uq_analytics_date").on(table.date)]
);

// ── Commodity Prices (fuel, grocery essentials) ───────────
export const commodityPrices = pgTable(
  "commodity_prices",
  {
    id: serial("id").primaryKey(),
    commodity: text("commodity").notNull(), // 'petrol', 'diesel', 'flour_atta', etc.
    unit: text("unit").notNull(), // 'liter', 'kg', 'dozen', 'per_liter'
    pricePkr: numeric("price_pkr", { precision: 10, scale: 2 }).notNull(),
    city: text("city"), // nullable — some prices are national like petrol
    source: text("source").notNull(),
    effectiveDate: date("effective_date"),
    recordedAt: timestamp("recorded_at").defaultNow(),
  },
  (table) => [
    index("idx_commodity_date").on(table.commodity, table.effectiveDate),
    index("idx_commodity_city").on(table.commodity, table.city),
  ]
);

// ── News Articles ────────────────────────────────────────
export const newsArticles = pgTable(
  "news_articles",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url").notNull(),
    sourceName: text("source_name"),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at"),
    category: text("category"), // 'economy', 'government', 'islamic_finance', 'energy', 'agriculture'
    fetchedAt: timestamp("fetched_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_news_url").on(table.url),
    index("idx_news_published").on(table.publishedAt),
    index("idx_news_category").on(table.category),
  ]
);

// ── Market Indices (KSE-100, KSE-30, etc.) ────────────────
export const marketIndices = pgTable(
  "market_indices",
  {
    id: serial("id").primaryKey(),
    indexName: text("index_name").notNull(), // 'KSE-100', 'KSE-30', 'KMI-30'
    openValue: numeric("open_value", { precision: 12, scale: 2 }),
    highValue: numeric("high_value", { precision: 12, scale: 2 }),
    lowValue: numeric("low_value", { precision: 12, scale: 2 }),
    closeValue: numeric("close_value", { precision: 12, scale: 2 }),
    volume: bigint("volume", { mode: "number" }),
    changePercent: numeric("change_percent", { precision: 6, scale: 2 }),
    tradeDate: date("trade_date").notNull(),
    source: text("source").notNull(),
    recordedAt: timestamp("recorded_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_index_date").on(table.indexName, table.tradeDate),
    index("idx_market_date").on(table.tradeDate),
  ]
);
