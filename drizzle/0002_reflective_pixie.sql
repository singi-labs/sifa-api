CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"did" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "rkey" text;