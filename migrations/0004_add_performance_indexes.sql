CREATE INDEX IF NOT EXISTS "videos_created_at_idx" ON "videos" ("created_at");
CREATE INDEX IF NOT EXISTS "channels_last_scraped_idx" ON "channels" ("last_scraped");
