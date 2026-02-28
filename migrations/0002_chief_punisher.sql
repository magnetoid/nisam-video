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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "error_bookmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"level" text NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"module" text,
	"url" text,
	"method" text,
	"status_code" integer,
	"user_id" text,
	"session_id" text,
	"user_agent" text,
	"ip" text,
	"context" json,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "error_events_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "hero_images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"aspect_ratio" varchar DEFAULT '16:9',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "kv_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" json,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "seo_ab_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"element_type" text NOT NULL,
	"page_url" text NOT NULL,
	"variant_a" text NOT NULL,
	"variant_b" text NOT NULL,
	"traffic_split" integer DEFAULT 50 NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"results" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_type" text NOT NULL,
	"page_url" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"issues" json,
	"recommendations" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_competitors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"name" text,
	"target_keywords" json,
	"backlinks" integer,
	"domain_authority" integer,
	"organic_traffic" integer,
	"last_analyzed" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"search_volume" integer,
	"competition" text,
	"difficulty" integer,
	"current_rank" integer,
	"target_rank" integer,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_meta_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_url" text NOT NULL,
	"page_type" text NOT NULL,
	"title" text,
	"description" text,
	"keywords" text,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"twitter_title" text,
	"twitter_description" text,
	"twitter_image" text,
	"canonical_url" text,
	"schema_markup" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"seo_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seo_meta_tags_page_url_unique" UNIQUE("page_url")
);
--> statement-breakpoint
CREATE TABLE "seo_redirects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_url" text NOT NULL,
	"to_url" text NOT NULL,
	"type" text DEFAULT 'permanent' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "scheduler_settings" ADD COLUMN "timezone" text DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "type" text DEFAULT 'channel_scan' NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "total_items" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "processed_items" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "failed_items" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "is_incremental" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "logs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "transitioning" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "error_bookmarks" ADD CONSTRAINT "error_bookmarks_fingerprint_error_events_fingerprint_fk" FOREIGN KEY ("fingerprint") REFERENCES "public"."error_events"("fingerprint") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_bookmarks_fingerprint_idx" ON "error_bookmarks" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_events_fingerprint_idx" ON "error_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_events_last_seen_at_idx" ON "error_events" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "hero_images_is_active_idx" ON "hero_images" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_meta_tags_page_url_idx" ON "seo_meta_tags" USING btree ("page_url");--> statement-breakpoint
CREATE INDEX "seo_meta_tags_page_type_idx" ON "seo_meta_tags" USING btree ("page_type");--> statement-breakpoint
CREATE INDEX "seo_meta_tags_is_active_idx" ON "seo_meta_tags" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "seo_meta_tags_created_at_idx" ON "seo_meta_tags" USING btree ("created_at");