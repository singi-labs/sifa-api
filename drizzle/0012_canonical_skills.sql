-- Enable pg_trgm for fuzzy matching in typeahead
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "canonical_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "category" text,
  "subcategory" text,
  "aliases" text[] NOT NULL DEFAULT '{}',
  "wikidata_id" text,
  "user_count" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "canonical_skills_slug_idx" ON "canonical_skills" ("slug");
CREATE INDEX IF NOT EXISTS "canonical_skills_trgm_idx" ON "canonical_skills" USING gin ("canonical_name" gin_trgm_ops);

CREATE TABLE IF NOT EXISTS "unresolved_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "raw_name" text NOT NULL,
  "normalized_name" text NOT NULL UNIQUE,
  "occurrences" integer NOT NULL DEFAULT 1,
  "first_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolved_to_id" uuid REFERENCES "canonical_skills"("id")
);

CREATE TABLE IF NOT EXISTS "skill_position_links" (
  "did" text NOT NULL REFERENCES "profiles"("did") ON DELETE CASCADE,
  "position_rkey" text NOT NULL,
  "skill_rkey" text NOT NULL,
  "indexed_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("did", "position_rkey", "skill_rkey")
);

ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "canonical_skill_id" uuid REFERENCES "canonical_skills"("id");
