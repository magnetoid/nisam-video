CREATE TABLE IF NOT EXISTS "analytics_custom_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar NOT NULL,
  "visitor_id" varchar NOT NULL,
  "event_name" text NOT NULL,
  "properties" jsonb,
  "timestamp" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "analytics_custom_events_session_id_idx" ON "analytics_custom_events" ("session_id");
CREATE INDEX IF NOT EXISTS "analytics_custom_events_visitor_id_idx" ON "analytics_custom_events" ("visitor_id");
CREATE INDEX IF NOT EXISTS "analytics_custom_events_event_name_idx" ON "analytics_custom_events" ("event_name");
CREATE INDEX IF NOT EXISTS "analytics_custom_events_timestamp_idx" ON "analytics_custom_events" ("timestamp");

CREATE TABLE IF NOT EXISTS "analytics_saved_views" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" varchar NOT NULL,
  "name" text NOT NULL,
  "visibility" text DEFAULT 'private' NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "analytics_saved_views_owner_idx" ON "analytics_saved_views" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "analytics_saved_views_updated_at_idx" ON "analytics_saved_views" ("updated_at");

CREATE INDEX IF NOT EXISTS "visitor_sessions_device_idx" ON "visitor_sessions" ("device");
CREATE INDEX IF NOT EXISTS "visitor_sessions_browser_idx" ON "visitor_sessions" ("browser");
CREATE INDEX IF NOT EXISTS "visitor_sessions_utm_source_idx" ON "visitor_sessions" ("utm_source");
CREATE INDEX IF NOT EXISTS "visitor_sessions_utm_medium_idx" ON "visitor_sessions" ("utm_medium");
CREATE INDEX IF NOT EXISTS "visitor_sessions_utm_campaign_idx" ON "visitor_sessions" ("utm_campaign");
