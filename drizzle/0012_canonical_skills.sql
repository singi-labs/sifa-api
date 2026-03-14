CREATE TABLE IF NOT EXISTS "canonical_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "canonical_name" text NOT NULL UNIQUE,
  "slug" text NOT NULL UNIQUE,
  "category" text,
  "subcategory" text,
  "aliases" text[] NOT NULL DEFAULT '{}',
  "wikidata_id" text,
  "user_count" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_canonical_skills_name_trgm
  ON canonical_skills
  USING GIN (canonical_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_canonical_skills_aliases_trgm
  ON canonical_skills
  USING GIN (aliases);
