-- Add missing system_settings columns that exist in shared/schema.ts but were never migrated.
-- Without these, PATCH /api/system/settings fails because Drizzle UPDATEs non-existent columns.

ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_name" text DEFAULT 'nisam.video - AI Video Hub';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_short_name" text DEFAULT 'nisam.video';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_description" text DEFAULT 'AI-powered YouTube video aggregation hub with curated content';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_theme_color" text DEFAULT '#E50914';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_background_color" text DEFAULT '#141414';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_icon_192" text DEFAULT '/icon-192.png';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_icon_512" text DEFAULT '/icon-512.png';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "youtube_api_key" text;
