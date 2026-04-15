-- Add optimized indexes for carousel filtering and sorting

-- Descending index on publish_date for faster "newest first" sorting
CREATE INDEX IF NOT EXISTS "videos_publish_date_desc_idx" ON "videos" ("publish_date" DESC NULLS LAST);

-- Composite index on video_categories for faster joins
CREATE INDEX IF NOT EXISTS "video_categories_cat_vid_idx" ON "video_categories" ("category_id", "video_id");
