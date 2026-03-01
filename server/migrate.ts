import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    
  await pool.query(
    `ALTER TABLE "hero_settings" ADD COLUMN IF NOT EXISTS "slide_count" integer DEFAULT 5;`
  );
}

async function ensureVideosColumns() {
  if (!pool) return;

  await pool.query(
    `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "primary_category_id" varchar;`,
  );
}

export async function runMigrations() {
  console.log("[migrate] Starting database migrations...");

  try {
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
      await ensureVideosColumns();
    } catch (e) {
      console.error("[migrate] videos bootstrap failed:", e);
    }

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

    // Run migrations
    // @ts-ignore - db type mismatch with migrator but strictly compatible at runtime
    await migrate(db, { migrationsFolder });

    console.log("[migrate] Database migrations completed successfully");
  } catch (error: any) {
    if (error?.code === '42P07') {
      console.log("[migrate] Tables already exist, skipping migration (safe to ignore)");
    } else {
      console.error("[migrate] Database migration failed:", error);
    }
    // We don't throw here to prevent the server from crashing completely
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations().catch(console.error);
}
