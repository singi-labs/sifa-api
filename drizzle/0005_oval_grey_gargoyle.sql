CREATE TABLE "certifications" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"name" text NOT NULL,
	"authority" text,
	"credential_id" text,
	"credential_url" text,
	"issued_at" text,
	"expires_at" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certifications_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"name" text NOT NULL,
	"number" text,
	"institution" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE "external_account_verifications" (
	"did" text NOT NULL,
	"url" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_via" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_account_verifications_did_url_pk" PRIMARY KEY("did","url")
);
--> statement-breakpoint
CREATE TABLE "external_accounts" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"feed_url" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_accounts_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE "honors" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"title" text NOT NULL,
	"issuer" text,
	"description" text,
	"awarded_at" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "honors_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"name" text NOT NULL,
	"proficiency" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "languages_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text,
	"started_at" text,
	"ended_at" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"title" text NOT NULL,
	"publisher" text,
	"url" text,
	"description" text,
	"published_at" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publications_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
CREATE TABLE "volunteering" (
	"did" text NOT NULL,
	"rkey" text NOT NULL,
	"organization" text NOT NULL,
	"role" text,
	"cause" text,
	"description" text,
	"started_at" text,
	"ended_at" text,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteering_did_rkey_pk" PRIMARY KEY("did","rkey")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_accounts" ADD CONSTRAINT "external_accounts_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "honors" ADD CONSTRAINT "honors_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "languages" ADD CONSTRAINT "languages_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteering" ADD CONSTRAINT "volunteering_did_profiles_did_fk" FOREIGN KEY ("did") REFERENCES "public"."profiles"("did") ON DELETE cascade ON UPDATE no action;