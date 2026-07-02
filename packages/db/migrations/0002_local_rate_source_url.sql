-- Markets: each reported local rate keeps the exact report it was read from (the APSGJA rate's
-- APP article changes daily), so every number on the site can link to its source.
-- Additive and nullable: safe on the live database.
ALTER TABLE "local_rates" ADD COLUMN IF NOT EXISTS "source_url" text;
