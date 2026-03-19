DO $$ BEGIN
  ALTER TABLE "profiles" ADD COLUMN "last_active_at" timestamp with time zone;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
