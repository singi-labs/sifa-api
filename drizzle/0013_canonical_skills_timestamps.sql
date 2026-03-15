-- Add created_at and updated_at columns to canonical_skills
ALTER TABLE "canonical_skills" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "canonical_skills" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

-- Make category NOT NULL with default 'technical' for existing rows
DO $$ BEGIN
  UPDATE "canonical_skills" SET "category" = 'technical' WHERE "category" IS NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE "canonical_skills" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "canonical_skills" ALTER COLUMN "category" SET DEFAULT 'technical';
