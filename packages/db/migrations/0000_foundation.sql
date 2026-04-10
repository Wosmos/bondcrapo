-- Foundation migration. Hand edited so it is safe on the live database, which was built
-- with `drizzle-kit push` and also holds tables created outside Drizzle (docs/DATA_AUDIT.md).
-- Review before running: `pnpm db:migrate` (try it on a Neon branch first). Never `push`.

-- 1. Preserve the prize bond data: winners becomes legacy_winners (no data loss).
DO $$
BEGIN
  IF to_regclass('public.winners') IS NOT NULL AND to_regclass('public.legacy_winners') IS NULL THEN
    ALTER TABLE "winners" RENAME TO "legacy_winners";
    ALTER SEQUENCE IF EXISTS "winners_id_seq" RENAME TO "legacy_winners_id_seq";
  END IF;
END $$;
--> statement-breakpoint

-- 2. Remove tables that held personal data (fingerprints, IP, geolocation, battery level)
--    and the old device keyed wallet, which the anonymous wallet replaces.
DROP TABLE IF EXISTS "events" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "devices" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "wallet_notifications" CASCADE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_bonds' AND column_name = 'device_fingerprint'
  ) THEN
    DROP TABLE "wallet_bonds" CASCADE;
  END IF;
END $$;
--> statement-breakpoint

-- 3. Out of band tables (created outside Drizzle by the retired Python scraper). Empty ones are dropped;
--    any that hold rows are renamed to legacy_<name> instead of being destroyed.
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'analytics_daily', 'commodity_prices', 'exchange_rates', 'gold_prices',
    'market_indices', 'news_articles', 'price_alerts', 'savings_rates'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
      IF n = 0 THEN
        EXECUTE format('DROP TABLE %I CASCADE', t);
      ELSE
        EXECUTE format('ALTER TABLE %I RENAME TO %I', t, 'legacy_' || t);
        RAISE NOTICE 'kept % rows of % as legacy_%', n, t, t;
      END IF;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

-- 4. draw_schedule (40 rows, 2026, source savings.gov.pk) was created outside Drizzle and its
--    column shapes are not recorded in this repository. It is kept as legacy_draw_schedule and
--    consumed by the bond backfill catalog step instead of being copied blindly into draws.
DO $$
BEGIN
  IF to_regclass('public.draw_schedule') IS NOT NULL AND to_regclass('public.legacy_draw_schedule') IS NULL THEN
    ALTER TABLE "draw_schedule" RENAME TO "legacy_draw_schedule";
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE "denominations" (
	"code" text PRIMARY KEY NOT NULL,
	"face_value" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"introduced_on" date,
	"discontinued_on" date,
	"encashment_deadline" date,
	"draws_per_year" smallint,
	"notes_en" text,
	"notes_ur" text
);
--> statement-breakpoint
CREATE TABLE "draw_prizes" (
	"draw_id" integer NOT NULL,
	"tier" smallint NOT NULL,
	"amount_pkr" bigint NOT NULL,
	"winners_count" integer NOT NULL,
	"inferred" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "draw_prizes_draw_id_tier_pk" PRIMARY KEY("draw_id","tier")
);
--> statement-breakpoint
CREATE TABLE "draw_results" (
	"draw_id" integer NOT NULL,
	"bond_number" integer NOT NULL,
	"tier" smallint NOT NULL,
	CONSTRAINT "draw_results_draw_id_bond_number_pk" PRIMARY KEY("draw_id","bond_number")
);
--> statement-breakpoint
CREATE TABLE "draw_sources" (
	"draw_id" integer NOT NULL,
	"document_sha256" text NOT NULL,
	"parser_version" text NOT NULL,
	"parsed_count" integer NOT NULL,
	"checksum" text,
	"role" text NOT NULL,
	CONSTRAINT "draw_sources_draw_id_document_sha256_pk" PRIMARY KEY("draw_id","document_sha256")
);
--> statement-breakpoint
CREATE TABLE "draws" (
	"id" serial PRIMARY KEY NOT NULL,
	"denomination_code" text NOT NULL,
	"draw_number" integer,
	"draw_date" date NOT NULL,
	"city" text,
	"status" text NOT NULL,
	"completeness" text DEFAULT 'none' NOT NULL,
	"result_checksum" text,
	"published_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_draw_denomination_date" UNIQUE("denomination_code","draw_date")
);
--> statement-breakpoint
CREATE TABLE "prize_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"denomination_code" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"tier" smallint NOT NULL,
	"amount_pkr" bigint NOT NULL,
	"winners_count" integer NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "uq_prize_structure" UNIQUE("denomination_code","effective_from","tier")
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"sha256" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"url" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"content_type" text,
	"bytes" integer,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_daily" (
	"quote" text NOT NULL,
	"date" date NOT NULL,
	"rate_from_usd" numeric(20, 10) NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "fx_daily_quote_date_pk" PRIMARY KEY("quote","date")
);
--> statement-breakpoint
CREATE TABLE "fx_pkr_market" (
	"currency" text NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"buy" numeric(20, 6) NOT NULL,
	"sell" numeric(20, 6) NOT NULL,
	"source" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "fx_pkr_market_currency_date_kind_pk" PRIMARY KEY("currency","date","kind")
);
--> statement-breakpoint
CREATE TABLE "local_rates" (
	"country" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"metal" text NOT NULL,
	"karat" smallint NOT NULL,
	"unit" text NOT NULL,
	"currency" text NOT NULL,
	"price" numeric(20, 4) NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"date" date NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "local_rates_country_city_metal_karat_unit_date_kind_pk" PRIMARY KEY("country","city","metal","karat","unit","date","kind")
);
--> statement-breakpoint
CREATE TABLE "metal_daily" (
	"metal" text NOT NULL,
	"date" date NOT NULL,
	"open_usd" numeric(20, 8) NOT NULL,
	"high_usd" numeric(20, 8) NOT NULL,
	"low_usd" numeric(20, 8) NOT NULL,
	"close_usd" numeric(20, 8) NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "metal_daily_metal_date_pk" PRIMARY KEY("metal","date")
);
--> statement-breakpoint
CREATE TABLE "metal_spot" (
	"metal" text NOT NULL,
	"price_usd_per_oz" numeric(20, 8) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "metal_spot_metal_source_observed_at_pk" PRIMARY KEY("metal","source","observed_at")
);
--> statement-breakpoint
CREATE TABLE "ingestion_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"entity" text NOT NULL,
	"entity_key" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"cursor" jsonb,
	"stats" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "wallet_bonds" (
	"wallet_id" uuid NOT NULL,
	"denomination_code" text NOT NULL,
	"bond_number" integer NOT NULL,
	"label" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_bonds_wallet_id_denomination_code_bond_number_pk" PRIMARY KEY("wallet_id","denomination_code","bond_number")
);
--> statement-breakpoint
CREATE TABLE "wallet_matches" (
	"wallet_id" uuid NOT NULL,
	"draw_id" integer NOT NULL,
	"bond_number" integer NOT NULL,
	"tier" smallint NOT NULL,
	"amount_pkr" bigint NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	CONSTRAINT "wallet_matches_wallet_id_draw_id_bond_number_pk" PRIMARY KEY("wallet_id","draw_id","bond_number")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"sync_code_hash" text,
	"locale" text,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	CONSTRAINT "wallets_sync_code_hash_unique" UNIQUE("sync_code_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legacy_winners" (
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
--> statement-breakpoint
ALTER TABLE "draw_prizes" ADD CONSTRAINT "draw_prizes_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_sources" ADD CONSTRAINT "draw_sources_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_sources" ADD CONSTRAINT "draw_sources_document_sha256_source_documents_sha256_fk" FOREIGN KEY ("document_sha256") REFERENCES "public"."source_documents"("sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_denomination_code_denominations_code_fk" FOREIGN KEY ("denomination_code") REFERENCES "public"."denominations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_structures" ADD CONSTRAINT "prize_structures_denomination_code_denominations_code_fk" FOREIGN KEY ("denomination_code") REFERENCES "public"."denominations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_issues" ADD CONSTRAINT "ingestion_issues_run_id_ingestion_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_bonds" ADD CONSTRAINT "wallet_bonds_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_bonds" ADD CONSTRAINT "wallet_bonds_denomination_code_denominations_code_fk" FOREIGN KEY ("denomination_code") REFERENCES "public"."denominations"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_matches" ADD CONSTRAINT "wallet_matches_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_matches" ADD CONSTRAINT "wallet_matches_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_draw_results_bond" ON "draw_results" USING btree ("bond_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_draw_denomination_number" ON "draws" USING btree ("denomination_code","draw_number") WHERE "draws"."draw_number" is not null;--> statement-breakpoint
CREATE INDEX "idx_draws_date" ON "draws" USING btree ("draw_date");--> statement-breakpoint
CREATE INDEX "idx_issues_run" ON "ingestion_issues" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_runs_job_started" ON "ingestion_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "idx_push_wallet" ON "push_subscriptions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_matches_draw" ON "wallet_matches" USING btree ("draw_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_source_denom_date_bond" ON "legacy_winners" USING btree ("source","denomination","draw_date","bond_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bond_number" ON "legacy_winners" USING btree ("bond_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_denomination" ON "legacy_winners" USING btree ("denomination");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_draw_date" ON "legacy_winners" USING btree ("draw_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_draw_number" ON "legacy_winners" USING btree ("draw_number");
--> statement-breakpoint

-- 5. Minimal denomination rows so foreign keys resolve. Lane A's seed upserts the dates,
--    notes and prize structures after verifying each against the National Savings pages.
INSERT INTO "denominations" ("code", "face_value", "kind", "status", "draws_per_year") VALUES
  ('100', 100, 'bearer', 'active', 4),
  ('200', 200, 'bearer', 'active', 4),
  ('750', 750, 'bearer', 'active', 4),
  ('1500', 1500, 'bearer', 'active', 4),
  ('7500', 7500, 'bearer', 'discontinued', 4),
  ('15000', 15000, 'bearer', 'discontinued', 4),
  ('25000', 25000, 'bearer', 'discontinued', 4),
  ('40000', 40000, 'bearer', 'discontinued', 4),
  ('25000P', 25000, 'premium_registered', 'active', 4),
  ('40000P', 40000, 'premium_registered', 'active', 4)
ON CONFLICT ("code") DO NOTHING;
