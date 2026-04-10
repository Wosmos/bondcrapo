/**
 * DDL of the production database as it was before the rebuild: the Drizzle tables from
 * the old `lib/schema.ts` plus the out of band tables listed in docs/DATA_AUDIT.md.
 * Out of band columns are approximations (their real DDL is not in the repository); the
 * migration only relies on their names and on row counts.
 */
export const LEGACY_SHAPES_SQL = `
CREATE TABLE "winners" (
  "id" serial PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "denomination" integer NOT NULL,
  "draw_number" integer,
  "draw_date" text NOT NULL,
  "draw_year" text,
  "city" text,
  "bond_number" text NOT NULL,
  "prize_position" text NOT NULL,
  "prize_amount" integer NOT NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX "uq_source_denom_date_bond" ON "winners" ("source","denomination","draw_date","bond_number");
CREATE INDEX "idx_bond_number" ON "winners" ("bond_number");
CREATE INDEX "idx_denomination" ON "winners" ("denomination");
CREATE INDEX "idx_draw_date" ON "winners" ("draw_date");
CREATE INDEX "idx_draw_number" ON "winners" ("draw_number");

CREATE TABLE "devices" (
  "id" serial PRIMARY KEY NOT NULL,
  "fingerprint" text NOT NULL,
  "first_seen" timestamp DEFAULT now(),
  "last_seen" timestamp DEFAULT now(),
  "total_sessions" integer DEFAULT 1,
  "country" text,
  "city" text,
  "raw_meta" jsonb
);
CREATE UNIQUE INDEX "uq_device_fingerprint" ON "devices" ("fingerprint");

CREATE TABLE "events" (
  "id" serial PRIMARY KEY NOT NULL,
  "device_fingerprint" text NOT NULL,
  "session_id" text NOT NULL,
  "event_type" text NOT NULL,
  "ip" text,
  "battery_level" text,
  "lat" text,
  "lng" text,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX "idx_events_device" ON "events" ("device_fingerprint");

CREATE TABLE "wallet_bonds" (
  "id" serial PRIMARY KEY NOT NULL,
  "device_fingerprint" text NOT NULL,
  "bond_number" text NOT NULL,
  "label" text,
  "denomination" integer,
  "added_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX "uq_device_bond" ON "wallet_bonds" ("device_fingerprint","bond_number");
CREATE INDEX "idx_wallet_device" ON "wallet_bonds" ("device_fingerprint");

CREATE TABLE "wallet_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "device_fingerprint" text NOT NULL,
  "bond_number" text NOT NULL,
  "winner_id" integer NOT NULL,
  "seen" integer DEFAULT 0
);

CREATE TABLE "draw_schedule" (
  "id" serial PRIMARY KEY,
  "denomination" integer,
  "draw_date" text,
  "draw_number" integer,
  "city" text,
  "source" text
);
CREATE TABLE "commodity_prices" ("id" serial PRIMARY KEY, "name" text, "price" numeric);
CREATE TABLE "savings_rates" ("id" serial PRIMARY KEY, "name" text, "rate" numeric);
CREATE TABLE "analytics_daily" ("id" serial PRIMARY KEY);
CREATE TABLE "exchange_rates" ("id" serial PRIMARY KEY);
CREATE TABLE "gold_prices" ("id" serial PRIMARY KEY);
CREATE TABLE "market_indices" ("id" serial PRIMARY KEY);
CREATE TABLE "news_articles" ("id" serial PRIMARY KEY);
CREATE TABLE "price_alerts" ("id" serial PRIMARY KEY);
`;
