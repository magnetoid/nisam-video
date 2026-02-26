ALTER TABLE "scheduler_settings" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC';

CREATE TABLE IF NOT EXISTS "error_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL UNIQUE,
	"level" text NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"module" text,
	"url" text,
	"method" text,
	"status_code" integer,
	"user_id" text,
	"session_id" text,
	"user_agent" text,
	"ip" text,
	"context" json,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
CREATE INDEX IF NOT EXISTS "error_events_fingerprint_idx" ON "error_events" ("fingerprint");
CREATE INDEX IF NOT EXISTS "error_events_last_seen_at_idx" ON "error_events" ("last_seen_at");

CREATE TABLE IF NOT EXISTS "error_bookmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "error_bookmarks_fingerprint_idx" ON "error_bookmarks" ("fingerprint");

DO $$ BEGIN
 ALTER TABLE "error_bookmarks" ADD CONSTRAINT "error_bookmarks_fingerprint_error_events_fingerprint_fk" FOREIGN KEY ("fingerprint") REFERENCES "error_events"("fingerprint") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
