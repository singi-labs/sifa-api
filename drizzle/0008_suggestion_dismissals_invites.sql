CREATE TABLE IF NOT EXISTS "suggestion_dismissals" (
	"user_did" text NOT NULL,
	"subject_did" text NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suggestion_dismissals_user_did_subject_did_pk" PRIMARY KEY("user_did","subject_did")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invites" (
	"inviter_did" text NOT NULL,
	"subject_did" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_inviter_did_subject_did_pk" PRIMARY KEY("inviter_did","subject_did")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suggestion_dismissals_user" ON "suggestion_dismissals" USING btree ("user_did");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invites_subject" ON "invites" USING btree ("subject_did");
