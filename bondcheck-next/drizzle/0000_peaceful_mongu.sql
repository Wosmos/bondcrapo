CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"first_seen" timestamp DEFAULT now(),
	"last_seen" timestamp DEFAULT now(),
	"total_sessions" integer DEFAULT 1,
	"os" text,
	"browser" text,
	"device_type" text,
	"screen_res" text,
	"language" text,
	"timezone" text,
	"country" text,
	"city" text,
	"raw_meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_fingerprint" text NOT NULL,
	"session_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"page" text,
	"referrer" text,
	"ip" text,
	"user_agent" text,
	"screen_width" integer,
	"screen_height" integer,
	"language" text,
	"timezone" text,
	"connection_type" text,
	"battery_level" text,
	"lat" text,
	"lng" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallet_bonds" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_fingerprint" text NOT NULL,
	"bond_number" text NOT NULL,
	"label" text,
	"denomination" integer,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "winners" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"denomination" integer NOT NULL,
	"draw_date" text NOT NULL,
	"draw_year" text,
	"bond_number" text NOT NULL,
	"prize_position" text NOT NULL,
	"prize_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_device_fingerprint" ON "devices" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_events_device" ON "events" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_events_session" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_events_created" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_device_bond" ON "wallet_bonds" USING btree ("device_fingerprint","bond_number");--> statement-breakpoint
CREATE INDEX "idx_wallet_device" ON "wallet_bonds" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_source_denom_date_bond" ON "winners" USING btree ("source","denomination","draw_date","bond_number");--> statement-breakpoint
CREATE INDEX "idx_bond_number" ON "winners" USING btree ("bond_number");--> statement-breakpoint
CREATE INDEX "idx_denomination" ON "winners" USING btree ("denomination");--> statement-breakpoint
CREATE INDEX "idx_draw_date" ON "winners" USING btree ("draw_date");