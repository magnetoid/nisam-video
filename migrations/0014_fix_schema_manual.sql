
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "banner_url" text;

ALTER TABLE "scheduler_settings" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC';

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scrape_jobs' AND column_name='type') THEN 
        ALTER TABLE "scrape_jobs" ADD COLUMN "type" text DEFAULT 'channel_scan' NOT NULL; 
    END IF;
END $$;

ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "target_id" text;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "total_items" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "processed_items" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "failed_items" integer DEFAULT 0 NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "is_incremental" boolean DEFAULT true NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "logs" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "transitioning" boolean DEFAULT false NOT NULL;
ALTER TABLE "scrape_jobs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hero_images') THEN 
        CREATE TABLE "hero_images" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "url" text NOT NULL,
            "alt" text,
            "aspect_ratio" varchar DEFAULT '16:9',
            "is_active" boolean DEFAULT true,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hero_settings') THEN 
        CREATE TABLE "hero_settings" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "fallback_images" json DEFAULT '[]'::jsonb,
            "rotation_interval" integer DEFAULT 4000,
            "animation_type" varchar DEFAULT 'fade',
            "default_placeholder_url" text,
            "enable_random" boolean DEFAULT true,
            "enable_images" boolean DEFAULT true,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_models') THEN 
        CREATE TABLE "ai_models" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "provider" text NOT NULL,
            "name" text NOT NULL,
            "size" varchar,
            "digest" text,
            "family" text,
            "format" text,
            "parameter_size" text,
            "quantization_level" text,
            "is_active" boolean DEFAULT true NOT NULL,
            "last_synced_at" timestamp DEFAULT now() NOT NULL,
            CONSTRAINT "ai_models_provider_name_unique" UNIQUE("provider","name")
        );
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_settings') THEN 
        CREATE TABLE "ai_settings" (
            "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "provider" text DEFAULT 'openai' NOT NULL,
            "openai_api_key" text,
            "openai_base_url" text,
            "openai_model" text DEFAULT 'gpt-5',
            "ollama_url" text DEFAULT 'http://localhost:11434',
            "ollama_model" text,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
    END IF;
END $$;
