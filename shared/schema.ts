import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  primaryKey,
  index,
  json,
  jsonb,
  unique,
  boolean
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const createInsertSchemaAny = (table: any) => createInsertSchema(table) as any;

// Users table - Authentication and role management
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // "admin" or "user"
  email: text("email"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

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

// Base Categories table (multilingual support)
export const categories = pgTable("categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  videoCount: integer("video_count").notNull().default(0),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Categories translations table
export const categoryTranslations = pgTable("category_translations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  languageCode: varchar("language_code", { length: 10 }).notNull(), // e.g., 'en', 'sr-Latn'
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  categoryLangUnique: unique().on(table.categoryId, table.languageCode),
  categorySlugUnique: unique().on(table.slug, table.languageCode),
  categoryIdIdx: index("category_translations_category_id_idx").on(table.categoryId),
  languageCodeIdx: index("category_translations_language_idx").on(table.languageCode),
}));

// Video-Category junction table (many-to-many, uses base category ID)
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

// Base Tags table (multilingual support)
export const tags = pgTable("tags", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  videoId: varchar("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Tags translations table
export const tagTranslations = pgTable("tag_translations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tagId: varchar("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
  languageCode: varchar("language_code", { length: 10 }).notNull(), // e.g., 'en', 'sr-Latn'
  tagName: text("tag_name").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  tagLangUnique: unique("tag_translations_tag_lang_unique").on(table.tagId, table.languageCode),
  tagNameUnique: unique("tag_translations_name_lang_unique").on(table.tagName, table.languageCode),
  tagIdIdx: index("tag_translations_tag_id_idx").on(table.tagId),
  languageCodeIdx: index("tag_translations_language_idx").on(table.languageCode),
}));

// Scheduler settings table - Configuration for automated scraping
export const schedulerSettings = pgTable("scheduler_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  isEnabled: integer("is_enabled").notNull().default(0), // 0 = disabled, 1 = enabled
  intervalHours: integer("interval_hours").notNull().default(6),
  timezone: text("timezone").default("UTC"),
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
  type: text("type").notNull().default("channel_scan"),
  targetId: text("target_id"),
  progress: integer("progress").notNull().default(0),
  totalItems: integer("total_items").notNull().default(0),
  processedItems: integer("processed_items").notNull().default(0),
  failedItems: integer("failed_items").notNull().default(0),
  isIncremental: boolean("is_incremental").notNull().default(true),
  logs: jsonb("logs").notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, cancelled
  transitioning: boolean("transitioning").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
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

// SEO Redirects table
export const seoRedirects = pgTable("seo_redirects", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fromUrl: text("from_url").notNull(),
  toUrl: text("to_url").notNull(),
  type: text("type").notNull().default("permanent"), // "permanent", "temporary"
  isActive: boolean("is_active").notNull().default(true),
  hits: integer("hits").notNull().default(0),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// SEO Meta Tags table
export const seoMetaTags = pgTable("seo_meta_tags", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  pageUrl: text("page_url").notNull().unique(),
  pageType: text("page_type").notNull().$type<'home' | 'video' | 'category' | 'tag' | 'custom'>(),
  title: text("title"),
  description: text("description"),
  keywords: text("keywords"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  twitterTitle: text("twitter_title"),
  twitterDescription: text("twitter_description"),
  twitterImage: text("twitter_image"),
  canonicalUrl: text("canonical_url"),
  schemaMarkup: jsonb("schema_markup"),
  isActive: boolean("is_active").notNull().default(true),
  seoScore: integer("seo_score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  pageUrlIdx: uniqueIndex("seo_meta_tags_page_url_idx").on(table.pageUrl),
  pageTypeIdx: index("seo_meta_tags_page_type_idx").on(table.pageType),
  isActiveIdx: index("seo_meta_tags_is_active_idx").on(table.isActive),
  createdAtIdx: index("seo_meta_tags_created_at_idx").on(table.createdAt),
}));

export const seoMetaTagsRelations = relations(seoMetaTags, ({ one }) => ({
  video: one(videos, {
    fields: [seoMetaTags.pageUrl],
    references: [videos.slug],
  }),
}));

export const insertSeoMetaTagSchema = createInsertSchema(seoMetaTags, {
  pageType: z.enum(['home', 'video', 'category', 'tag', 'custom']),
  schemaMarkup: z.union([z.record(z.unknown()), z.null()]),
}).omit({ id: true, createdAt: true, updatedAt: true, seoScore: true });

export const updateSeoMetaTagSchema = createInsertSchema(seoMetaTags, {
  pageType: z.enum(['home', 'video', 'category', 'tag', 'custom']),
  schemaMarkup: z.union([z.record(z.unknown()), z.null()]),
}).omit({ id: true, createdAt: true }).partial();

// SEO Keywords table
export const seoKeywords = pgTable("seo_keywords", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  keyword: text("keyword").notNull(),
  searchVolume: integer("search_volume"),
  competition: text("competition"), // "low", "medium", "high"
  difficulty: integer("difficulty"),
  currentRank: integer("current_rank"),
  targetRank: integer("target_rank"),
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  ctr: integer("ctr").notNull().default(0),
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// SEO Audit Logs table
export const seoAuditLogs = pgTable("seo_audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  auditType: text("audit_type").notNull(),
  pageUrl: text("page_url").notNull(),
  score: integer("score").notNull().default(0),
  issues: json("issues"),
  recommendations: json("recommendations"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// SEO A/B Tests table
export const seoABTests = pgTable("seo_ab_tests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  elementType: text("element_type").notNull(), // "title", "description", "og_title", "og_description"
  pageUrl: text("page_url").notNull(),
  variantA: text("variant_a").notNull(),
  variantB: text("variant_b").notNull(),
  trafficSplit: integer("traffic_split").notNull().default(50),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("draft"),
  results: json("results"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// SEO Competitors table
export const seoCompetitors = pgTable("seo_competitors", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  domain: text("domain").notNull(),
  name: text("name"),
  targetKeywords: json("target_keywords"),
  backlinks: integer("backlinks"),
  domainAuthority: integer("domain_authority"),
  organicTraffic: integer("organic_traffic"),
  lastAnalyzed: timestamp("last_analyzed"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
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

// Hero Videos table - Configuration for featured hero section videos
export const heroVideos = pgTable("hero_videos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slot: integer("slot").notNull().unique(), // 1 to 5, enforces exactly 5 slots
  videoId: varchar("video_id")
    .references(() => videos.id, { onDelete: "set null" }), // Set to null if video deleted
  title: text("title").notNull(),
  description: text("description").notNull(),
  buttonText: text("button_text").notNull(),
  buttonLink: text("button_link").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  slotIdx: index("hero_videos_slot_idx").on(table.slot),
  videoIdIdx: index("hero_videos_video_id_idx").on(table.videoId),
}));

// Hero Images table - Configuration for hero section images
export const heroImages = pgTable("hero_images", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  alt: text("alt"),
  aspectRatio: varchar("aspect_ratio").default("16:9"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  isActiveIdx: index("hero_images_is_active_idx").on(table.isActive),
}));

// Hero Settings table - Configuration for hero slider behavior
export const heroSettings = pgTable("hero_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fallbackImages: json("fallback_images").default(sql`[]::jsonb`),
  rotationInterval: integer("rotation_interval").default(4000),
  animationType: varchar("animation_type").default("fade"),
  defaultPlaceholderUrl: text("default_placeholder_url"),
  enableRandom: boolean("enable_random").default(true),
  enableImages: boolean("enable_images").default(true),
  updatedAt: timestamp("updated_at")
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
  heroVideos: many(heroVideos), // Videos can be featured in hero
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  videoCategories: many(videoCategories),
  translations: many(categoryTranslations),
}));

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, {
    fields: [categoryTranslations.categoryId],
    references: [categories.id],
  }),
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

export const tagsRelations = relations(tags, ({ one, many }) => ({
  video: one(videos, {
    fields: [tags.videoId],
    references: [videos.id],
  }),
  translations: many(tagTranslations),
}));

export const tagTranslationsRelations = relations(tagTranslations, ({ one }) => ({
  tag: one(tags, {
    fields: [tagTranslations.tagId],
    references: [tags.id],
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

export const heroVideosRelations = relations(heroVideos, ({ one }) => ({
  video: one(videos, {
    fields: [heroVideos.videoId],
    references: [videos.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchemaAny(users).omit({
  id: true,
  createdAt: true,
});

export const insertChannelSchema = createInsertSchemaAny(channels).omit({
  id: true,
  createdAt: true,
  videoCount: true,
  lastScraped: true,
}).extend({
  platform: z.enum(["youtube", "tiktok"]).optional().default("youtube"),
});

export const insertVideoSchema = createInsertSchemaAny(videos).omit({
  id: true,
  createdAt: true,
}).extend({
  videoType: z.enum(["regular", "youtube_short", "tiktok"]).optional().default("regular"),
});

// Base insert for categories (no name/slug/desc)
export const insertCategorySchema = createInsertSchemaAny(categories).omit({
  id: true,
  videoCount: true,
  createdAt: true,
});

// Translations insert schema
export const insertCategoryTranslationSchema = createInsertSchemaAny(categoryTranslations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchemaAny(tags).omit({
  id: true,
  createdAt: true,
});

export const insertTagTranslationSchema = createInsertSchemaAny(tagTranslations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// Translations insert schema
export type CategoryTranslation = typeof categoryTranslations.$inferSelect;
export type InsertCategoryTranslation = z.infer<typeof insertCategoryTranslationSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type TagTranslation = typeof tagTranslations.$inferSelect;
export type InsertTagTranslation = z.infer<typeof insertTagTranslationSchema>;

export const insertSchedulerSettingsSchema = createInsertSchemaAny(
  schedulerSettings,
).omit({
  id: true,
  updatedAt: true,
});

export type SchedulerSettings = typeof schedulerSettings.$inferSelect;
export type InsertSchedulerSettings = z.infer<
  typeof insertSchedulerSettingsSchema
>;

export const insertPlaylistSchema = createInsertSchemaAny(playlists).omit({
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

export type VideoWithLocalizedRelations = VideoWithRelations & {
  categories: LocalizedCategory[];
  tags: LocalizedTag[];
};

// Extended types for localized data
export type LocalizedCategory = Category & {
  translations: CategoryTranslation[];
  name: string;
  slug: string;
  description: string | null;
};

export type LocalizedTag = Tag & {
  translations: TagTranslation[];
  tagName: string;
};

export type PlaylistWithVideos = Playlist & {
  videos: VideoWithRelations[];
};

export const insertSeoSettingsSchema = createInsertSchemaAny(seoSettings).omit({
  id: true,
  updatedAt: true,
});

export type SeoSettings = typeof seoSettings.$inferSelect;
export type InsertSeoSettings = z.infer<typeof insertSeoSettingsSchema>;

export const insertScrapeJobSchema = createInsertSchemaAny(scrapeJobs).omit({
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
  clientErrorLogging: integer("client_error_logging").notNull().default(1), // 0 = disabled, 1 = enabled
  // About page
  aboutPageContent: text("about_page_content"),
  // Custom code injection for GTM, analytics, etc.
  gtmId: text("gtm_id"),
  ga4Id: text("ga4_id"),
  customHeadCode: text("custom_head_code"), // Injected in <head> (for GTM, analytics)
  customBodyStartCode: text("custom_body_start_code"), // Injected after <body> (for GTM noscript)
  customBodyEndCode: text("custom_body_end_code"), // Injected before </body> (for tracking scripts)
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Error Events table - Stores unique error occurrences
export const errorEvents = pgTable("error_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fingerprint: text("fingerprint").notNull().unique(), // Used for deduplication and grouping
  level: text("level").notNull(), // "debug", "info", "warn", "error", "critical"
  type: text("type").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  module: text("module"),
  url: text("url"),
  method: text("method"),
  statusCode: integer("status_code"),
  userId: text("user_id"),
  sessionId: text("session_id"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  context: json("context"),
  firstSeenAt: timestamp("first_seen_at")
    .notNull()
    .default(sql`now()`),
  lastSeenAt: timestamp("last_seen_at")
    .notNull()
    .default(sql`now()`),
  count: integer("count").notNull().default(1),
}, (table) => ({
  fingerprintIdx: index("error_events_fingerprint_idx").on(table.fingerprint),
  lastSeenAtIdx: index("error_events_last_seen_at_idx").on(table.lastSeenAt),
}));

// Error Bookmarks table - Stores user notes on specific errors
export const errorBookmarks = pgTable("error_bookmarks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fingerprint: text("fingerprint")
    .notNull()
    .references(() => errorEvents.fingerprint, { onDelete: "cascade" }),
  note: text("note"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  bookmarkFingerprintIdx: index("error_bookmarks_fingerprint_idx").on(table.fingerprint),
}));

// Analytics Events table
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventName: text("event_name").notNull(),
  triggerType: text("trigger_type").notNull(), // click, form_submit, page_view
  selector: text("selector"), // CSS selector for click/submit
  parameters: json("parameters"), // Additional parameters
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
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

export const insertSystemSettingsSchema = createInsertSchemaAny(
  systemSettings,
).omit({
  id: true,
  updatedAt: true,
});

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

export const insertActivityLogSchema = createInsertSchemaAny(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Validation schema inferred from server/routes/logs.ts usage
export const insertErrorEventSchema = createInsertSchemaAny(errorEvents).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
  count: true,
});

export type ErrorEvent = typeof errorEvents.$inferSelect;
export type ErrorBookmark = typeof errorBookmarks.$inferSelect;

export const insertAnalyticsEventSchema = createInsertSchemaAny(analyticsEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

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

// Session table for connect-pg-simple
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => ({
  expireIdx: index("IDX_session_expire").on(table.expire),
}));

export const insertTagImageSchema = createInsertSchemaAny(tagImages).omit({
  id: true,
  createdAt: true,
});

export type TagImage = typeof tagImages.$inferSelect;
export type InsertTagImage = z.infer<typeof insertTagImageSchema>;

// Hero Videos insert schema
export const insertHeroVideoSchema = createInsertSchemaAny(heroVideos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type HeroVideo = typeof heroVideos.$inferSelect;
export type InsertHeroVideo = z.infer<typeof insertHeroVideoSchema>;

export type HeroVideoWithVideo = HeroVideo & {
  video: Video;
};

// Hero Images insert schema
export const insertHeroImageSchema = createInsertSchemaAny(heroImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type HeroImage = typeof heroImages.$inferSelect;
export type InsertHeroImage = z.infer<typeof insertHeroImageSchema>;

// Hero Settings insert schema
export const insertHeroSettingsSchema = createInsertSchemaAny(heroSettings).omit({
  id: true,
  updatedAt: true,
}).extend({
  animationType: z.enum(["fade", "slide"]).optional().default("fade"),
  fallbackImages: z.array(z.string()).optional().default([]),
});

export type HeroSettings = typeof heroSettings.$inferSelect;
export type InsertHeroSettings = z.infer<typeof insertHeroSettingsSchema>;

// AI Settings table - Configuration for AI providers
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("openai"), // 'openai' | 'ollama'
  openaiApiKey: text("openai_api_key"),
  openaiBaseUrl: text("openai_base_url"),
  openaiModel: text("openai_model").default("gpt-5"),
  ollamaUrl: text("ollama_url").default("http://localhost:11434"),
  ollamaModel: text("ollama_model"), // Selected model for generation
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// AI Models table - Cache of available models
export const aiModels = pgTable("ai_models", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(), // 'openai' | 'ollama'
  name: text("name").notNull(),
  size: varchar("size"), // string representation or bytes
  digest: text("digest"),
  family: text("family"),
  format: text("format"),
  parameterSize: text("parameter_size"),
  quantizationLevel: text("quantization_level"),
  isActive: boolean("is_active").notNull().default(true), // Enabled/Disabled in UI
  lastSyncedAt: timestamp("last_synced_at")
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  providerNameUnique: unique("ai_models_provider_name_unique").on(table.provider, table.name),
}));

// KV Store table - Key-value storage for rate limiting, buffers, etc.
export const kvStore = pgTable("kv_store", {
  key: text("key").primaryKey(),
  value: json("value"), // Store complex data as JSON
  expiresAt: timestamp("expires_at"),
});

export const insertAiSettingsSchema = createInsertSchemaAny(aiSettings).omit({
  id: true,
  updatedAt: true,
});

export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;

export const insertAiModelSchema = createInsertSchemaAny(aiModels).omit({
  id: true,
  lastSyncedAt: true,
});

export type AiModel = typeof aiModels.$inferSelect;
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;
