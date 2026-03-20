CREATE TABLE IF NOT EXISTS "user_app_stats" (
  "did" text NOT NULL REFERENCES "profiles"("did") ON DELETE CASCADE,
  "app_id" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "recent_count" integer NOT NULL DEFAULT 0,
  "latest_record_at" timestamptz,
  "refreshed_at" timestamptz NOT NULL DEFAULT now(),
  "visible" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("did", "app_id")
);

CREATE INDEX IF NOT EXISTS "idx_user_app_stats_app_count" ON "user_app_stats" ("app_id", "recent_count");
CREATE INDEX IF NOT EXISTS "idx_user_app_stats_refreshed" ON "user_app_stats" ("refreshed_at");
CREATE INDEX IF NOT EXISTS "idx_user_app_stats_visible" ON "user_app_stats" ("did", "visible", "recent_count");

CREATE TABLE IF NOT EXISTS "suppressed_dids" (
  "did" text PRIMARY KEY,
  "requested_at" timestamptz NOT NULL DEFAULT now()
);
