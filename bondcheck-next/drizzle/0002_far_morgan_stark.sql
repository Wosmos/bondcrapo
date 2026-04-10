CREATE TABLE "analytics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_sessions" integer DEFAULT 0,
	"unique_devices" integer DEFAULT 0,
	"total_searches" integer DEFAULT 0,
	"total_wallet_checks" integer DEFAULT 0,
	"total_bond_scans" integer DEFAULT 0,
	"top_denominations" jsonb,
	"device_breakdown" jsonb,
	"browser_breakdown" jsonb
);
--> statement-breakpoint
CREATE TABLE "crypto_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"price_usd" numeric(16, 2) NOT NULL,
	"price_pkr" numeric(16, 2),
	"change_24h_percent" numeric(6, 2),
	"volume_24h" numeric(20, 2),
	"source" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draw_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"denomination" integer NOT NULL,
	"draw_number" integer,
	"draw_date" date NOT NULL,
	"city" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"rate_type" text NOT NULL,
	"rate" numeric(12, 4) NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gold_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"karat" text NOT NULL,
	"unit" text NOT NULL,
	"price_pkr" numeric(12, 2) NOT NULL,
	"price_usd" numeric(10, 2),
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_indices" (
	"id" serial PRIMARY KEY NOT NULL,
	"index_name" text NOT NULL,
	"open_value" numeric(12, 2),
	"high_value" numeric(12, 2),
	"low_value" numeric(12, 2),
	"close_value" numeric(12, 2),
	"volume" bigint,
	"change_percent" numeric(6, 2),
	"trade_date" date NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_fingerprint" text NOT NULL,
	"alert_type" text NOT NULL,
	"target_value" numeric(16, 2),
	"params" jsonb,
	"triggered" boolean DEFAULT false,
	"triggered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "savings_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"certificate_type" text NOT NULL,
	"display_name" text NOT NULL,
	"rate_percent" numeric(5, 2) NOT NULL,
	"effective_date" date,
	"maturity_period" text,
	"min_investment" integer,
	"eligibility" text,
	"profit_payment" text,
	"source" text DEFAULT 'savings_gov_pk' NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_analytics_date" ON "analytics_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_crypto_symbol_time" ON "crypto_prices" USING btree ("symbol","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_schedule_denom_date" ON "draw_schedule" USING btree ("denomination","draw_date");--> statement-breakpoint
CREATE INDEX "idx_schedule_status" ON "draw_schedule" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_schedule_date" ON "draw_schedule" USING btree ("draw_date");--> statement-breakpoint
CREATE INDEX "idx_fx_pair_time" ON "exchange_rates" USING btree ("base_currency","quote_currency","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_gold_snapshot" ON "gold_prices" USING btree ("source","karat","unit","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_gold_recorded" ON "gold_prices" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_gold_karat_unit" ON "gold_prices" USING btree ("karat","unit");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_index_date" ON "market_indices" USING btree ("index_name","trade_date");--> statement-breakpoint
CREATE INDEX "idx_market_date" ON "market_indices" USING btree ("trade_date");--> statement-breakpoint
CREATE INDEX "idx_alerts_device" ON "price_alerts" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_alerts_active" ON "price_alerts" USING btree ("triggered","alert_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_savings_rate" ON "savings_rates" USING btree ("certificate_type","rate_percent","effective_date");--> statement-breakpoint
CREATE INDEX "idx_savings_type" ON "savings_rates" USING btree ("certificate_type");