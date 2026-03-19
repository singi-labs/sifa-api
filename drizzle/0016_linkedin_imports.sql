CREATE TABLE IF NOT EXISTS "linkedin_imports" (
  "id" serial PRIMARY KEY,
  "did" text NOT NULL REFERENCES "profiles"("did"),
  "success" boolean NOT NULL,
  "position_count" integer NOT NULL DEFAULT 0,
  "education_count" integer NOT NULL DEFAULT 0,
  "skill_count" integer NOT NULL DEFAULT 0,
  "certification_count" integer NOT NULL DEFAULT 0,
  "project_count" integer NOT NULL DEFAULT 0,
  "volunteering_count" integer NOT NULL DEFAULT 0,
  "publication_count" integer NOT NULL DEFAULT 0,
  "course_count" integer NOT NULL DEFAULT 0,
  "honor_count" integer NOT NULL DEFAULT 0,
  "language_count" integer NOT NULL DEFAULT 0,
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_linkedin_imports_created_at" ON "linkedin_imports" ("created_at");
