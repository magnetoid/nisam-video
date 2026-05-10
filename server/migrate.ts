import { pool } from "./db.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

async function applySqlMigrations(migrationsFolder: string) {
  if (!pool) return;
  const entries = fs.readdirSync(migrationsFolder, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const duplicateCodes = new Set(["42P07", "42701", "42710"]);

  for (const file of files) {
    const fullPath = path.join(migrationsFolder, file);
    const sqlText = fs.readFileSync(fullPath, "utf8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    // Per-file isolation: a failure in one migration file should not block
    // subsequent files. Within a file we do stop at the first hard failure,
    // since later statements may depend on earlier ones.
    let fileFailed = false;
    for (const stmt of statements) {
      if (fileFailed) break;
      try {
        await pool.query(stmt);
      } catch (e: any) {
        if (e?.code && duplicateCodes.has(String(e.code))) {
          console.log(`[migrate] Skipped already-applied statement (${e.code}) from ${file}`);
          continue;
        }
        console.error(`[migrate] ${file} failed at statement (code=${e?.code}): ${e?.message || e}`);
        fileFailed = true;
      }
    }
  }
}

async function ensureScrapeJobsColumns() {
  if (!pool) return;

  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'channel_scan' NOT NULL;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "transitioning" boolean DEFAULT false NOT NULL;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "target_id" text;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "total_items" integer DEFAULT 0 NOT NULL;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "processed_items" integer DEFAULT 0 NOT NULL;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "failed_items" integer DEFAULT 0 NOT NULL;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "is_incremental" boolean DEFAULT true NOT NULL;`,
  );
  await pool.query(
    `ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "logs" jsonb DEFAULT '[]'::jsonb;`,
  );
}

async function ensureHeroTables() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "hero_images" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "url" text NOT NULL,
      "alt" text,
      "aspect_ratio" varchar DEFAULT '16:9',
      "is_active" boolean DEFAULT true,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "hero_images_is_active_idx" ON "hero_images" USING btree ("is_active");`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "hero_settings" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "fallback_images" jsonb DEFAULT '[]'::jsonb,
      "rotation_interval" integer DEFAULT 4000,
      "animation_type" varchar DEFAULT 'fade',
      "default_placeholder_url" text,
      "enable_random" boolean DEFAULT true,
      "enable_images" boolean DEFAULT true,
      "slide_count" integer DEFAULT 5,
      "home_hero_mode" text DEFAULT 'primary',
      "popular_page_mode" text DEFAULT 'views',
      "popular_segments" jsonb DEFAULT '[]'::jsonb,
      "show_recent" boolean DEFAULT true,
      "show_trending" boolean DEFAULT true,
      "show_popular" boolean DEFAULT true,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    
  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "slide_count" integer DEFAULT 5;`
  );

  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "home_hero_mode" text DEFAULT 'primary';`,
  );
  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "popular_page_mode" text DEFAULT 'views';`,
  );
  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "popular_segments" jsonb DEFAULT '[]'::jsonb;`,
  );
  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "show_recent" boolean DEFAULT true;`,
  );
  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "show_trending" boolean DEFAULT true;`,
  );
  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "show_popular" boolean DEFAULT true;`,
  );
}

async function ensureSystemSettingsColumns() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "system_settings" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "maintenance_mode" integer DEFAULT 0 NOT NULL,
      "maintenance_message" text,
      "allow_registration" integer DEFAULT 0 NOT NULL,
      "items_per_page" integer DEFAULT 24 NOT NULL,
      "cache_enabled" integer DEFAULT 1 NOT NULL,
      "cache_videos_ttl" integer DEFAULT 300 NOT NULL,
      "cache_channels_ttl" integer DEFAULT 600 NOT NULL,
      "cache_categories_ttl" integer DEFAULT 600 NOT NULL,
      "cache_api_ttl" integer DEFAULT 180 NOT NULL,
      "pwa_enabled" integer DEFAULT 1 NOT NULL,
      "pwa_name" text DEFAULT 'nisam.video - AI Video Hub',
      "pwa_short_name" text DEFAULT 'nisam.video',
      "pwa_description" text DEFAULT 'AI-powered YouTube video aggregation hub with curated content',
      "pwa_theme_color" text DEFAULT '#E50914',
      "pwa_background_color" text DEFAULT '#141414',
      "pwa_icon_192" text DEFAULT '/icon-192.png',
      "pwa_icon_512" text DEFAULT '/icon-512.png',
      "client_error_logging" integer DEFAULT 1 NOT NULL,
      "about_page_content" text,
      "gtm_id" text,
      "ga4_id" text,
      "custom_head_code" text,
      "custom_body_start_code" text,
      "custom_body_end_code" text,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_enabled" integer DEFAULT 1 NOT NULL;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_name" text DEFAULT 'nisam.video - AI Video Hub';`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_short_name" text DEFAULT 'nisam.video';`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_description" text DEFAULT 'AI-powered YouTube video aggregation hub with curated content';`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_theme_color" text DEFAULT '#E50914';`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_background_color" text DEFAULT '#141414';`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_icon_192" text DEFAULT '/icon-192.png';`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "pwa_icon_512" text DEFAULT '/icon-512.png';`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "client_error_logging" integer DEFAULT 1 NOT NULL;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "about_page_content" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "gtm_id" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "ga4_id" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "custom_head_code" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "custom_body_start_code" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "custom_body_end_code" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "youtube_api_key" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "turnstile_enabled" integer DEFAULT 0 NOT NULL;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "turnstile_site_key" text;`);
  await pool.query(`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "turnstile_secret_key" text;`);
}

async function ensureVideosColumns() {
  if (!pool) return;

  await pool.query(
    `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "primary_category_id" varchar;`,
  );
}

async function ensureSeoSettingsColumns() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "seo_settings" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "site_name" text DEFAULT 'nisam.video' NOT NULL,
      "site_description" text DEFAULT 'AI-powered video aggregation hub featuring curated YouTube content organized by intelligent categorization' NOT NULL,
      "og_image" text,
      "twitter_handle" text,
      "social_links" jsonb DEFAULT '{}'::jsonb,
      "meta_keywords" text,
      "google_search_console_api_key" text,
      "bing_webmaster_api_key" text,
      "enable_auto_sitemap_submission" boolean DEFAULT false NOT NULL,
      "enable_schema_markup" boolean DEFAULT true NOT NULL,
      "enable_hreflang" boolean DEFAULT true NOT NULL,
      "enable_ab_testing" boolean DEFAULT false NOT NULL,
      "default_language" text DEFAULT 'en',
      "enable_amp" boolean DEFAULT false NOT NULL,
      "enable_pwa" boolean DEFAULT false NOT NULL,
      "robots_txt" text,
      "enable_local_seo" boolean DEFAULT false NOT NULL,
      "business_name" text,
      "business_address" text,
      "business_phone" text,
      "business_email" text,
      "business_hours" text,
      "latitude" double precision,
      "longitude" double precision,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "twitter_handle" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "google_search_console_api_key" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "bing_webmaster_api_key" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "enable_auto_sitemap_submission" boolean DEFAULT false NOT NULL;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "enable_schema_markup" boolean DEFAULT true NOT NULL;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "enable_hreflang" boolean DEFAULT true NOT NULL;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "enable_ab_testing" boolean DEFAULT false NOT NULL;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "default_language" text DEFAULT 'en';`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "enable_amp" boolean DEFAULT false NOT NULL;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "enable_pwa" boolean DEFAULT false NOT NULL;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "robots_txt" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "enable_local_seo" boolean DEFAULT false NOT NULL;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "business_name" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "business_address" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "business_phone" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "business_email" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "business_hours" text;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "latitude" double precision;`);
  await pool.query(`ALTER TABLE "seo_settings" ADD COLUMN IF NOT EXISTS "longitude" double precision;`);
}

async function ensureChannelRecommendationsTable() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "channel_recommendations" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "url" text NOT NULL UNIQUE,
      "description" text,
      "platform" text DEFAULT 'youtube' NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "approved_channel_id" varchar,
      "reviewed_by" varchar,
      "reviewed_at" timestamp,
      "rejection_reason" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(
    `ALTER TABLE "channel_recommendations" ADD COLUMN IF NOT EXISTS "approved_channel_id" varchar;`,
  );
  await pool.query(
    `ALTER TABLE "channel_recommendations" ADD COLUMN IF NOT EXISTS "reviewed_by" varchar;`,
  );
  await pool.query(
    `ALTER TABLE "channel_recommendations" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;`,
  );
  await pool.query(
    `ALTER TABLE "channel_recommendations" ADD COLUMN IF NOT EXISTS "rejection_reason" text;`,
  );
}

async function ensureEmailSettingsTable() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "email_settings" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "mode" text DEFAULT 'smtp' NOT NULL,
      "smtp_host" text,
      "smtp_port" integer,
      "smtp_username" text,
      "smtp_password" text,
      "smtp_secure" integer DEFAULT 1 NOT NULL,
      "smtp_from_email" text,
      "smtp_from_name" text,
      "imap_host" text,
      "imap_port" integer,
      "imap_username" text,
      "imap_password" text,
      "imap_secure" integer DEFAULT 1 NOT NULL,
      "imap_mailbox" text,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`ALTER TABLE "email_settings" ADD COLUMN IF NOT EXISTS "smtp_from_email" text;`);
  await pool.query(`ALTER TABLE "email_settings" ADD COLUMN IF NOT EXISTS "smtp_from_name" text;`);
  await pool.query(`ALTER TABLE "email_settings" ADD COLUMN IF NOT EXISTS "imap_mailbox" text;`);
}

async function ensureAiTables() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ai_settings" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "provider" text DEFAULT 'ollama' NOT NULL,
      "openai_api_key" text,
      "openai_base_url" text,
      "openai_model" text,
      "ollama_url" text DEFAULT 'http://localhost:11434',
      "ollama_model" text DEFAULT 'llama3',
      "ollama_api_key" text,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'ollama' NOT NULL;`);
  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "openai_api_key" text;`);
  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "openai_base_url" text;`);
  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "openai_model" text;`);
  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "ollama_url" text DEFAULT 'http://localhost:11434';`);
  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "ollama_model" text DEFAULT 'llama3';`);
  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "ollama_api_key" text;`);
  await pool.query(`ALTER TABLE "ai_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ai_models" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "provider" text NOT NULL,
      "name" text NOT NULL,
      "size" text,
      "digest" text,
      "family" text,
      "format" text,
      "parameter_size" text,
      "quantization_level" text,
      "is_active" boolean DEFAULT true,
      "last_synced_at" timestamp DEFAULT now()
    );
  `);

  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ai_models_provider_name_unique" ON "ai_models" ("provider", "name");`,
  );
}

export async function runMigrations() {
  console.log("[migrate] Starting database migrations...");

  try {
    // Determine the migrations folder path
    // Try multiple common locations for Vercel/Serverless environments
    const candidates = [
      path.join(process.cwd(), "migrations"), // Standard Vercel root
      path.join(process.cwd(), "../migrations"), // If CWD is api/
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations"), // Relative to this file
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migrations"), // Relative to build output
      // Dodajem i apsolutnu putanju za Docker
      "/app/migrations"
    ];

    let migrationsFolder = "";
    
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, "meta"))) {
        migrationsFolder = candidate;
        console.log(`[migrate] Found migrations folder at ${migrationsFolder}`);
        break;
      }
    }
    
    if (!migrationsFolder) {
      console.warn(`[migrate] Migrations folder not found. Searched: ${candidates.join(", ")}`);
      // List contents of current directory to help debug
      try {
        console.log(`[migrate] CWD contents: ${fs.readdirSync(process.cwd()).join(", ")}`);
      } catch (e) {
        console.warn("[migrate] Failed to list CWD");
      }
      return;
    }

    // Apply SQL migration files. If any single file throws (e.g. an early
    // migration without IF NOT EXISTS guards), don't abort the whole chain —
    // the idempotent bootstrap functions below are designed to fill any gap.
    try {
      await applySqlMigrations(migrationsFolder);
      console.log("[migrate] Database migrations completed successfully");
    } catch (e) {
      console.error("[migrate] applySqlMigrations failed (continuing to bootstraps):", e);
    }

    try {
      await ensureScrapeJobsColumns();
    } catch (e) {
      console.error("[migrate] scrape_jobs bootstrap failed:", e);
    }
    try {
      await ensureHeroTables();
    } catch (e) {
      console.error("[migrate] hero bootstrap failed:", e);
    }
    try {
      await ensureSystemSettingsColumns();
    } catch (e) {
      console.error("[migrate] system_settings bootstrap failed:", e);
    }
    try {
      await ensureVideosColumns();
    } catch (e) {
      console.error("[migrate] videos bootstrap failed:", e);
    }
    try {
      await ensureSeoSettingsColumns();
    } catch (e) {
      console.error("[migrate] seo_settings bootstrap failed:", e);
    }
    try {
      await ensureChannelRecommendationsTable();
    } catch (e) {
      console.error("[migrate] channel_recommendations bootstrap failed:", e);
    }
    try {
      await ensureEmailSettingsTable();
    } catch (e) {
      console.error("[migrate] email_settings bootstrap failed:", e);
    }
    try {
      await ensureAiTables();
    } catch (e) {
      console.error("[migrate] ai tables bootstrap failed:", e);
    }
  } catch (error: any) {
    console.error("[migrate] Database migration failed:", error);
    // We don't throw here to prevent the server from crashing completely
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations().catch(console.error);
}
