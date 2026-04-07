-- Cloudflare Turnstile settings
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "turnstile_enabled" integer NOT NULL DEFAULT 0;
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "turnstile_site_key" text;
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "turnstile_secret_key" text;
