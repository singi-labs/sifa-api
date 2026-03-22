CREATE TABLE IF NOT EXISTS "email_subscriptions" (
  "did" text NOT NULL REFERENCES "profiles"("did") ON DELETE CASCADE,
  "email" text NOT NULL,
  "source" text NOT NULL DEFAULT 'welcome',
  "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("did")
);

CREATE INDEX IF NOT EXISTS "idx_email_subscriptions_email" ON "email_subscriptions" ("email");
