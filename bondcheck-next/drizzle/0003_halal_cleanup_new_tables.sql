-- Migration: Remove crypto (haram), add commodity_prices + news_articles
-- Drop crypto_prices table (haram content removed)
DROP TABLE IF EXISTS "crypto_prices";
--> statement-breakpoint
CREATE TABLE "commodity_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"commodity" text NOT NULL,
	"unit" text NOT NULL,
	"price_pkr" numeric(10, 2) NOT NULL,
	"city" text,
	"source" text NOT NULL,
	"effective_date" date,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"source_name" text,
	"image_url" text,
	"published_at" timestamp,
	"category" text,
	"fetched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_commodity_date" ON "commodity_prices" USING btree ("commodity","effective_date");
--> statement-breakpoint
CREATE INDEX "idx_commodity_city" ON "commodity_prices" USING btree ("commodity","city");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_news_url" ON "news_articles" USING btree ("url");
--> statement-breakpoint
CREATE INDEX "idx_news_published" ON "news_articles" USING btree ("published_at");
--> statement-breakpoint
CREATE INDEX "idx_news_category" ON "news_articles" USING btree ("category");
