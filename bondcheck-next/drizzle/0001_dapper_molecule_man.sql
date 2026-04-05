CREATE TABLE "wallet_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_fingerprint" text NOT NULL,
	"bond_number" text NOT NULL,
	"winner_id" integer NOT NULL,
	"denomination" integer NOT NULL,
	"prize_position" text NOT NULL,
	"prize_amount" integer NOT NULL,
	"draw_date" text NOT NULL,
	"seen" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "winners" ADD COLUMN "draw_number" integer;--> statement-breakpoint
ALTER TABLE "winners" ADD COLUMN "city" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notif_device_winner" ON "wallet_notifications" USING btree ("device_fingerprint","winner_id");--> statement-breakpoint
CREATE INDEX "idx_notif_device" ON "wallet_notifications" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_notif_unseen" ON "wallet_notifications" USING btree ("device_fingerprint","seen");--> statement-breakpoint
CREATE INDEX "idx_draw_number" ON "winners" USING btree ("draw_number");