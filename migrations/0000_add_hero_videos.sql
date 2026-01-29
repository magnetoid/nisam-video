CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" text,
	"username" text NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"video_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"channel_id" text,
	"thumbnail_url" text,
	"video_count" integer DEFAULT 0 NOT NULL,
	"platform" text DEFAULT 'youtube' NOT NULL,
	"last_scraped" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channels_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "hero_videos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot" integer NOT NULL,
	"video_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"button_text" text NOT NULL,
	"button_link" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hero_videos_slot_unique" UNIQUE("slot")
);
--> statement-breakpoint
CREATE TABLE "playlist_videos" (
	"playlist_id" varchar NOT NULL,
	"video_id" varchar NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_videos_playlist_id_video_id_pk" PRIMARY KEY("playlist_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"video_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduler_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_enabled" integer DEFAULT 0 NOT NULL,
	"interval_hours" integer DEFAULT 6 NOT NULL,
	"last_run" timestamp,
	"next_run" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_channels" integer DEFAULT 0 NOT NULL,
	"processed_channels" integer DEFAULT 0 NOT NULL,
	"current_channel_name" text,
	"videos_added" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_name" text DEFAULT 'nisam.video' NOT NULL,
	"site_description" text DEFAULT 'AI-powered video aggregation hub featuring curated YouTube content organized by intelligent categorization' NOT NULL,
	"og_image" text,
	"meta_keywords" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
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
	"client_error_logging" integer DEFAULT 1 NOT NULL,
	"about_page_content" text,
	"custom_head_code" text,
	"custom_body_start_code" text,
	"custom_body_end_code" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_name" text NOT NULL,
	"image_url" text NOT NULL,
	"is_ai_generated" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tag_images_tag_name_unique" UNIQUE("tag_name")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" varchar NOT NULL,
	"tag_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_categories" (
	"video_id" varchar NOT NULL,
	"category_id" varchar NOT NULL,
	CONSTRAINT "video_categories_video_id_category_id_pk" PRIMARY KEY("video_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "video_likes" (
	"video_id" varchar NOT NULL,
	"user_identifier" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_likes_video_id_user_identifier_pk" PRIMARY KEY("video_id","user_identifier")
);
--> statement-breakpoint
CREATE TABLE "video_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" varchar NOT NULL,
	"user_identifier" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"video_id" text NOT NULL,
	"slug" text,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_url" text NOT NULL,
	"duration" text,
	"view_count" text,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"internal_views_count" integer DEFAULT 0 NOT NULL,
	"publish_date" text,
	"video_type" text DEFAULT 'regular' NOT NULL,
	"embed_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "videos_video_id_unique" UNIQUE("video_id"),
	CONSTRAINT "videos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "hero_videos" ADD CONSTRAINT "hero_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_categories" ADD CONSTRAINT "video_categories_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_categories" ADD CONSTRAINT "video_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_likes" ADD CONSTRAINT "video_likes_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hero_videos_slot_idx" ON "hero_videos" USING btree ("slot");--> statement-breakpoint
CREATE INDEX "hero_videos_video_id_idx" ON "hero_videos" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "video_categories_category_id_idx" ON "video_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "videos_publish_date_idx" ON "videos" USING btree ("publish_date");--> statement-breakpoint
CREATE INDEX "videos_channel_id_idx" ON "videos" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "videos_video_type_idx" ON "videos" USING btree ("video_type");