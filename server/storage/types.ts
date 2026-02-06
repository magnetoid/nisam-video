import {
  type User,
  type InsertUser,
  type Channel,
  type InsertChannel,
  type Video,
  type InsertVideo,
  type VideoWithLocalizedRelations,
  type HeroVideoWithVideo,
  type InsertHeroVideo,
  type LocalizedCategory,
  type InsertCategory,
  type InsertCategoryTranslation,
  type CategoryTranslation,
  type Category,
  type LocalizedTag,
  type InsertTag,
  type InsertTagTranslation,
  type TagTranslation,
  type Tag,
  type Playlist,
  type InsertPlaylist,
  type PlaylistWithVideos,
  type PlaylistVideo,
  type SeoSettings,
  type ScrapeJob,
  type InsertScrapeJob,
  type SchedulerSettings,
  type SystemSettings,
  type TagImage,
  type InsertTagImage,
  type AnalyticsEvent,
  type InsertAnalyticsEvent
} from "../../shared/schema.js";

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;

  // Channels
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(id: string): Promise<Channel | undefined>;
  getAllChannels(): Promise<Channel[]>;
  updateChannel(
    id: string,
    data: Partial<Channel>,
  ): Promise<Channel | undefined>;
  deleteChannel(id: string): Promise<void>;
  getChannelsByPlatform(platform: string): Promise<Channel[]>;

  // Videos
  createVideo(video: InsertVideo): Promise<Video>;
  getVideo(id: string): Promise<Video | undefined>;
  getVideoBySlug(slug: string): Promise<Video | undefined>;
  getVideoWithRelations(id: string, lang?: string): Promise<VideoWithLocalizedRelations | undefined>;
  getVideoWithRelationsBySlug(
    slug: string, lang?: string
  ): Promise<VideoWithLocalizedRelations | undefined>;
  getAllVideos(filters?: {
    channelId?: string;
    categoryId?: string;
    search?: string;
    tagName?: string;
    lang?: string;
    limit?: number;
    offset?: number;
  }): Promise<VideoWithLocalizedRelations[]>;
  updateVideo(id: string, data: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<void>;
  getVideoByVideoId(videoId: string): Promise<Video | undefined>;
  getVideoIdsByChannel(channelId: string): Promise<string[]>;
  countVideosByChannel(channelId: string): Promise<number>;
  
  // Optimized limited queries (database-level LIMIT)
  getHeroVideo(lang?: string): Promise<VideoWithLocalizedRelations | null>;
  getRecentVideos(limit: number, lang?: string): Promise<VideoWithLocalizedRelations[]>;
  getVideosByCategory(categoryId: string, limit: number, lang?: string): Promise<VideoWithLocalizedRelations[]>;
  getTrendingVideos(limit: number, lang?: string): Promise<VideoWithLocalizedRelations[]>;
  
  // Hero Videos
  getHeroVideos(): Promise<HeroVideoWithVideo[]>;
  getActiveHeroVideos(): Promise<HeroVideoWithVideo[]>;
  getHomeHeroVideos(limit: number, lang?: string): Promise<VideoWithLocalizedRelations[]>;
  updateHeroVideos(heroVideos: InsertHeroVideo[]): Promise<HeroVideoWithVideo[]>;
  
  // Shorts (YouTube Shorts and TikTok)
  getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number; lang?: string }): Promise<VideoWithLocalizedRelations[]>;

  // Categories (localized)
  createCategory(base: InsertCategory, translations: Omit<InsertCategoryTranslation, "categoryId">[]): Promise<LocalizedCategory>;
  getLocalizedCategory(id: string, lang: string): Promise<LocalizedCategory | undefined>;
  getLocalizedCategoryBySlug(slug: string, lang: string): Promise<LocalizedCategory | undefined>;
  getAllLocalizedCategories(lang: string): Promise<LocalizedCategory[]>;
  updateLocalizedCategory(id: string, lang: string, data: Partial<CategoryTranslation>): Promise<CategoryTranslation | undefined>;
  updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  addCategoryTranslation(categoryId: string, translation: InsertCategoryTranslation): Promise<CategoryTranslation>;
  deleteCategoryTranslation(categoryId: string, lang: string): Promise<void>;
  getCategoryWithAllTranslations(id: string): Promise<(Category & { translations: CategoryTranslation[] }) | undefined>;
  getAllCategoriesWithTranslations(): Promise<(Category & { translations: CategoryTranslation[] })[]>;

  // Tags (localized)
  createTag(base: InsertTag, translations: Omit<InsertTagTranslation, "tagId">[]): Promise<LocalizedTag>;
  getLocalizedTag(id: string, lang: string): Promise<LocalizedTag | undefined>;
  getLocalizedTagByName(name: string, lang: string): Promise<LocalizedTag | undefined>;
  getAllLocalizedTags(lang: string): Promise<LocalizedTag[]>;
  getLocalizedTagsByVideoId(videoId: string, lang: string): Promise<LocalizedTag[]>;
  updateLocalizedTag(id: string, lang: string, data: Partial<TagTranslation>): Promise<TagTranslation | undefined>;
  deleteTag(id: string): Promise<void>;
  addTagTranslation(tagId: string, translation: InsertTagTranslation): Promise<TagTranslation>;
  deleteTagTranslation(tagId: string, lang: string): Promise<void>;
  deleteTagsByVideoId(videoId: string): Promise<void>;
  getTagWithAllTranslations(id: string): Promise<(Tag & { translations: TagTranslation[] }) | undefined>;
  getAllTagsWithTranslations(): Promise<(Tag & { translations: TagTranslation[] })[]>;

  // Video-Category relations
  addVideoCategory(videoId: string, categoryId: string): Promise<void>;
  removeVideoCategories(videoId: string): Promise<void>;

  // Playlists
  createPlaylist(playlist: InsertPlaylist): Promise<Playlist>;
  getPlaylist(id: string): Promise<Playlist | undefined>;
  getPlaylistWithVideos(id: string): Promise<PlaylistWithVideos | undefined>;
  getAllPlaylists(): Promise<Playlist[]>;
  updatePlaylist(
    id: string,
    data: Partial<Playlist>,
  ): Promise<Playlist | undefined>;
  deletePlaylist(id: string): Promise<void>;
  addVideoToPlaylist(
    playlistId: string,
    videoId: string,
    position?: number,
  ): Promise<void>;
  removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void>;
  getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]>;

  // SEO Settings
  getSeoSettings(): Promise<SeoSettings | undefined>;
  updateSeoSettings(data: Partial<SeoSettings>): Promise<SeoSettings>;

  // Scrape Jobs
  createScrapeJob(job: InsertScrapeJob): Promise<ScrapeJob>;
  getScrapeJob(id: string): Promise<ScrapeJob | undefined>;
  getActiveScrapeJob(): Promise<ScrapeJob | undefined>;
  updateScrapeJob(
    id: string,
    data: Partial<ScrapeJob>,
  ): Promise<ScrapeJob | undefined>;

  // Scheduler Settings
  getSchedulerSettings(): Promise<SchedulerSettings | undefined>;
  updateSchedulerSettings(data: Partial<SchedulerSettings>): Promise<SchedulerSettings>;

  // System Settings
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings>;

  // Tag Images
  getTagImage(tagName: string): Promise<TagImage | undefined>;
  updateTagImage(data: InsertTagImage): Promise<TagImage>;
  deleteTagImage(tagName: string): Promise<void>;

  // Analytics Events
  getAnalyticsEvents(): Promise<AnalyticsEvent[]>;
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  updateAnalyticsEvent(id: string, event: Partial<AnalyticsEvent>): Promise<AnalyticsEvent | undefined>;
  deleteAnalyticsEvent(id: string): Promise<void>;

  // Utilities
  updateAllVideoThumbnails(): Promise<number>;
  incrementVideoViews(videoId: string, count: number): Promise<void>;
}
