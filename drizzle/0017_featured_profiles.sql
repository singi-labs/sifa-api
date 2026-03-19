CREATE TABLE IF NOT EXISTS "featured_profiles" (
  "id" serial PRIMARY KEY,
  "did" text NOT NULL,
  "featured_date" date NOT NULL UNIQUE,
  "posted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
