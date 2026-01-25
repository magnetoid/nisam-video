import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Channels table - YouTube channels and TikTok profiles to scrape
export const channels = pgTable("channels", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  channelId: text("channel_id"), // YouTube channel ID or TikTok username
  thumbnailUrl: text("thumbnail_url"),
  videoCount: integer("video_count").notNull().default(0),
  platform: text("platform").notNull().default("youtube"), // "youtube" or "tiktok"
  lastScraped: timestamp("last_scraped"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Videos table - Aggregated video content
export const videos = pgTable("videos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull().unique(), // YouTube video ID or TikTok video ID
  slug: text("slug").unique(), // SEO-friendly URL slug (nullable for backward compatibility)
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url").notNull(),
  duration: text("duration"),
  viewCount: text("view_count"), // View count (external)
  likesCount: integer("likes_count").notNull().default(0), // Internal likes count
  internalViewsCount: integer("internal_views_count").notNull().default(0), // Internal views count
  publishDate: text("publish_date"),
  videoType: text("video_type").notNull().default("regular"), // "regular", "youtube_short", "tiktok"
  embedUrl: text("embed_url"), // TikTok embed URL (optional, for TikTok videos)
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  publishDateIdx: index("videos_publish_date_idx").on(table.publishDate),
  channelIdIdx: index("videos_channel_id_idx").on(table.channelId),
  videoTypeIdx: index("videos_video_type_idx").on(table.videoType),
}));

// Categories table - AI-generated or manual categories
export const categories = pgTable("categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  videoCount: integer("video_count").notNull().default(0),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Video-Category junction table (many-to-many)
export const videoCategories = pgTable(
  "video_categories",
  {
    videoId: varchar("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    categoryId: varchar("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.videoId, table.categoryId] }),
    categoryIdIdx: index("video_categories_category_id_idx").on(table.categoryId),
  }),
);

// Tags table - AI-generated tags for videos
export const tags = pgTable("tags", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  videoId: varchar("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  tagName: text("tag_name").notNull(),
});

// Scheduler settings table - Configuration for automated scraping
export const schedulerSettings = pgTable("scheduler_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  isEnabled: integer("is_enabled").notNull().default(0), // 0 = disabled, 1 = enabled
  intervalHours: integer("interval_hours").notNull().default(6),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Scrape jobs table - Track scraping progress
export const scrapeJobs = pgTable("scrape_jobs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  totalChannels: integer("total_channels").notNull().default(0),
  processedChannels: integer("processed_channels").notNull().default(0),
  currentChannelName: text("current_channel_name"),
  videosAdded: integer("videos_added").notNull().default(0),
  startedAt: timestamp("started_at")
    .notNull()
    .default(sql`now()`),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

// Playlists table - User-created video playlists
export const playlists = pgTable("playlists", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  videoCount: integer("video_count").notNull().default(0),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Playlist-Video junction table (many-to-many with ordering)
export const playlistVideos = pgTable(
  "playlist_videos",
  {
    playlistId: varchar("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    videoId: varchar("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playlistId, table.videoId] }),
  }),
);

// SEO settings table - Global SEO configuration
export const seoSettings = pgTable("seo_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  siteName: text("site_name").notNull().default("nisam.video"),
  siteDescription: text("site_description")
    .notNull()
    .default(
      "AI-powered video aggregation hub featuring curated YouTube content organized by intelligent categorization",
    ),
  ogImage: text("og_image"),
  metaKeywords: text("meta_keywords"),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Video likes table - Track user likes per video
export const videoLikes = pgTable(
  "video_likes",
  {
    videoId: varchar("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    userIdentifier: text("user_identifier").notNull(), // IP address or session ID
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.videoId, table.userIdentifier] }),
  }),
);

// Video views table - Track internal video views
export const videoViews = pgTable("video_views", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  videoId: varchar("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  userIdentifier: text("user_identifier").notNull(), // IP address or session ID
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Relations
export const channelsRelations = relations(channels, ({ many }) => ({
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  channel: one(channels, {
    fields: [videos.channelId],
    references: [channels.id],
  }),
  videoCategories: many(videoCategories),
  tags: many(tags),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  videoCategories: many(videoCategories),
}));

export const videoCategoriesRelations = relations(
  videoCategories,
  ({ one }) => ({
    video: one(videos, {
      fields: [videoCategories.videoId],
      references: [videos.id],
    }),
    category: one(categories, {
      fields: [videoCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const tagsRelations = relations(tags, ({ one }) => ({
  video: one(videos, {
    fields: [tags.videoId],
    references: [videos.id],
  }),
}));

export const playlistsRelations = relations(playlists, ({ many }) => ({
  playlistVideos: many(playlistVideos),
}));

export const playlistVideosRelations = relations(playlistVideos, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistVideos.playlistId],
    references: [playlists.id],
  }),
  video: one(videos, {
    fields: [playlistVideos.videoId],
    references: [videos.id],
  }),
}));

export const videoLikesRelations = relations(videoLikes, ({ one }) => ({
  video: one(videos, {
    fields: [videoLikes.videoId],
    references: [videos.id],
  }),
}));

export const videoViewsRelations = relations(videoViews, ({ one }) => ({
  video: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  }),
}));

// Insert schemas
export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
  videoCount: true,
  lastScraped: true,
}).extend({
  platform: z.enum(["youtube", "tiktok"]).optional().default("youtube"),
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
}).extend({
  videoType: z.enum(["regular", "youtube_short", "tiktok"]).optional().default("regular"),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  videoCount: true,
  createdAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
});

// Types
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export const insertSchedulerSettingsSchema = createInsertSchema(
  schedulerSettings,
).omit({
  id: true,
  updatedAt: true,
});

export type SchedulerSettings = typeof schedulerSettings.$inferSelect;
export type InsertSchedulerSettings = z.infer<
  typeof insertSchedulerSettingsSchema
>;

export const insertPlaylistSchema = createInsertSchema(playlists).omit({
  id: true,
  createdAt: true,
  videoCount: true,
});

export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;

export type PlaylistVideo = typeof playlistVideos.$inferSelect;

export type VideoWithRelations = Video & {
  channel: Channel;
  tags: Tag[];
  categories: Category[];
};

export type PlaylistWithVideos = Playlist & {
  videos: VideoWithRelations[];
};

export const insertSeoSettingsSchema = createInsertSchema(seoSettings).omit({
  id: true,
  updatedAt: true,
});

export type SeoSettings = typeof seoSettings.$inferSelect;
export type InsertSeoSettings = z.infer<typeof insertSeoSettingsSchema>;

export const insertScrapeJobSchema = createInsertSchema(scrapeJobs).omit({
  id: true,
  startedAt: true,
});

export type ScrapeJob = typeof scrapeJobs.$inferSelect;
export type InsertScrapeJob = z.infer<typeof insertScrapeJobSchema>;

export type VideoLike = typeof videoLikes.$inferSelect;
export type VideoView = typeof videoViews.$inferSelect;

// System settings table - General application configuration
export const systemSettings = pgTable("system_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  maintenanceMode: integer("maintenance_mode").notNull().default(0), // 0 = disabled, 1 = enabled
  maintenanceMessage: text("maintenance_message"),
  allowRegistration: integer("allow_registration").notNull().default(0), // Future feature
  itemsPerPage: integer("items_per_page").notNull().default(24),
  // Cache settings
  cacheEnabled: integer("cache_enabled").notNull().default(1), // 0 = disabled, 1 = enabled
  cacheVideosTTL: integer("cache_videos_ttl").notNull().default(300), // seconds (5 minutes)
  cacheChannelsTTL: integer("cache_channels_ttl").notNull().default(600), // seconds (10 minutes)
  cacheCategoriesTTL: integer("cache_categories_ttl").notNull().default(600), // seconds (10 minutes)
  cacheApiTTL: integer("cache_api_ttl").notNull().default(180), // seconds (3 minutes)
  // PWA settings
  pwaEnabled: integer("pwa_enabled").notNull().default(1), // 0 = disabled, 1 = enabled
  // About page
  aboutPageContent: text("about_page_content"),
  // Custom code injection for GTM, analytics, etc.
  customHeadCode: text("custom_head_code"), // Injected in <head> (for GTM, analytics)
  customBodyStartCode: text("custom_body_start_code"), // Injected after <body> (for GTM noscript)
  customBodyEndCode: text("custom_body_end_code"), // Injected before </body> (for tracking scripts)
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Activity logs table - Track admin actions for auditing
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // e.g., "create_channel", "delete_video", etc.
  entityType: text("entity_type").notNull(), // "channel", "video", "category", etc.
  entityId: text("entity_id"), // ID of the affected entity
  details: text("details"), // JSON string with additional details
  username: text("username").notNull(), // Who performed the action
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

export const insertSystemSettingsSchema = createInsertSchema(
  systemSettings,
).omit({
  id: true,
  updatedAt: true,
});

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Tag Images table - Store images for unique tag names
export const tagImages = pgTable("tag_images", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tagName: text("tag_name").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  isAiGenerated: integer("is_ai_generated").notNull().default(0), // 0 = custom upload, 1 = AI generated
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

export const insertTagImageSchema = createInsertSchema(tagImages).omit({
  id: true,
  createdAt: true,
});

export type TagImage = typeof tagImages.$inferSelect;
export type InsertTagImage = z.infer<typeof insertTagImageSchema>;
