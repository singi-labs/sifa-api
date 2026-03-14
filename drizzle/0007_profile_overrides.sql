ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "headline_override" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "about_override" text;
