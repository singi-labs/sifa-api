ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "country_code" text;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "country_code" text;
