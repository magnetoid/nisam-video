-- Performance indexes for frequently queried columns

-- Videos: slug lookups, sorting by views/likes, created_at filtering
CREATE INDEX IF NOT EXISTS "videos_created_at_idx" ON "videos" ("created_at");
CREATE INDEX IF NOT EXISTS "videos_slug_idx" ON "videos" ("slug");
CREATE INDEX IF NOT EXISTS "videos_internal_views_idx" ON "videos" ("internal_views_count");
CREATE INDEX IF NOT EXISTS "videos_likes_count_idx" ON "videos" ("likes_count");

-- Channels: scheduler queries by last_scraped, platform filtering
CREATE INDEX IF NOT EXISTS "channels_last_scraped_idx" ON "channels" ("last_scraped");
CREATE INDEX IF NOT EXISTS "channels_platform_idx" ON "channels" ("platform");

-- Tags: join queries on video_id
CREATE INDEX IF NOT EXISTS "tags_video_id_idx" ON "tags" ("video_id");

-- Video views: aggregate queries by video_id, time-range filtering
CREATE INDEX IF NOT EXISTS "video_views_video_id_idx" ON "video_views" ("video_id");
CREATE INDEX IF NOT EXISTS "video_views_created_at_idx" ON "video_views" ("created_at");

-- Scrape jobs: status filtering, ordering by started_at
CREATE INDEX IF NOT EXISTS "scrape_jobs_status_idx" ON "scrape_jobs" ("status");
CREATE INDEX IF NOT EXISTS "scrape_jobs_started_at_idx" ON "scrape_jobs" ("started_at");

-- Activity logs: time-range queries, entity type filtering
CREATE INDEX IF NOT EXISTS "activity_logs_created_at_idx" ON "activity_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "activity_logs_entity_type_idx" ON "activity_logs" ("entity_type");
