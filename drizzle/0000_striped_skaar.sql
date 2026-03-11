CREATE TABLE IF NOT EXISTS "education" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"institution" text NOT NULL,
	"institution_did" text,
	"degree" text,
	"field_of_study" text,
	"description" text,
	"start_date" text,
	"end_date" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "education_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "positions" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"company_name" text NOT NULL,
	"company_did" text,
	"title" text NOT NULL,
	"description" text,
	"employment_type" text,
	"workplace_type" text,
	"location_country" text,
	"location_region" text,
	"location_city" text,
	"start_date" text NOT NULL,
	"end_date" text,
	"current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"did" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"headline" text,
	"about" text,
	"industry" text,
	"location_country" text,
	"location_region" text,
	"location_city" text,
	"website" text,
	"open_to" text[],
	"preferred_workplace" text[],
	"langs" text[],
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skills" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"skill_name" text NOT NULL,
	"category" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "education" ADD CONSTRAINT "education_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "positions" ADD CONSTRAINT "positions_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "skills" ADD CONSTRAINT "skills_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_profiles_handle" ON "profiles" USING btree ("handle");
