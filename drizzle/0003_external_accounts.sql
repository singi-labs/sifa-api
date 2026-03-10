CREATE TABLE IF NOT EXISTS "external_accounts" (
  "did" text NOT NULL REFERENCES "profiles"("did") ON DELETE CASCADE,
  "rkey" text NOT NULL,
  "platform" text NOT NULL,
  "url" text NOT NULL,
  "label" text,
  "feed_url" text,
  "created_at" timestamp with time zone NOT NULL,
  "indexed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "external_accounts_pkey" PRIMARY KEY ("did", "rkey")
);

CREATE TABLE IF NOT EXISTS "external_account_verifications" (
  "did" text NOT NULL,
  "url" text NOT NULL,
  "verified" boolean NOT NULL DEFAULT false,
  "verified_via" text,
  "checked_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "external_account_verifications_pkey" PRIMARY KEY ("did", "url")
);
