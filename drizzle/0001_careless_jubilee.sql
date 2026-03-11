CREATE TABLE IF NOT EXISTS "connections" (
	"follower_did" text NOT NULL,
	"subject_did" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_follower_did_subject_did_source_pk" PRIMARY KEY("follower_did","subject_did","source")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jetstream_cursor" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"cursor" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"did" text NOT NULL,
	"handle" text NOT NULL,
	"pds_url" text NOT NULL,
	"token_set" jsonb NOT NULL,
	"dpop_key" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_connections_subject" ON "connections" USING btree ("subject_did");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_connections_follower" ON "connections" USING btree ("follower_did");
