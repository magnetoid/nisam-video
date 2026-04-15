
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'channel_scan' NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "target_id" text;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "total_items" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "processed_items" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "failed_items" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "is_incremental" boolean DEFAULT true NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "logs" jsonb DEFAULT '[]'::jsonb;
