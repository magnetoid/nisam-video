// Reference: javascript_database blueprint
import {
  channels,
  videos,
  categories,
  tags,
  videoCategories,
  playlists,
  playlistVideos,
  seoSettings,
  scrapeJobs,
  schedulerSettings,
  systemSettings,
  tagImages,
  heroVideos,
  categoryTranslations,
  tagTranslations,
  type Channel,
  type InsertChannel,
  type Video,
  type InsertVideo,
  type Category,
  type InsertCategory,
  type Tag,
  type InsertTag,
  type VideoWithRelations,
  type LocalizedCategory,
  type CategoryTranslation,
  type InsertCategoryTranslation,
  type LocalizedTag,
  type TagTranslation,
  type InsertTagTranslation,
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
  type HeroVideo,
  type InsertHeroVideo,
  type HeroVideoWithVideo,
  type VideoWithLocalizedRelations,
} from "../shared/schema.js";
import { db, dbUrl } from "./db.js";
import { eq, like, and, inArray, sql, desc } from "drizzle-orm";
import { cache } from "./cache.js";

// Cache settings helper
let cachedSettings: any = null;
let settingsLastFetched = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute

async function getCacheSettings() {
  const now = Date.now();
  if (cachedSettings && now - settingsLastFetched < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }

  // Use storage abstraction instead of direct DB access
  const settings = await storage.getSystemSettings();
  
  if (settings) {
    cachedSettings = {
      enabled: settings.cacheEnabled === 1,
      videosTTL: settings.cacheVideosTTL * 1000, // Convert to ms
      channelsTTL: settings.cacheChannelsTTL * 1000,
      categoriesTTL: settings.cacheCategoriesTTL * 1000,
      apiTTL: settings.cacheApiTTL * 1000,
    };
    settingsLastFetched = now;
  } else {
    // Default values if no settings exist
    cachedSettings = {
      enabled: true,
      videosTTL: 300000, // 5 minutes
      channelsTTL: 600000, // 10 minutes
      categoriesTTL: 600000, // 10 minutes
      apiTTL: 180000, // 3 minutes
    };
    settingsLastFetched = now;
  }

  return cachedSettings;
}

export interface IStorage {
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
    lang?: string;
  }): Promise<VideoWithLocalizedRelations[]>;
  updateVideo(id: string, data: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<void>;
  getVideoByVideoId(videoId: string): Promise<Video | undefined>;
  
  // Optimized limited queries (database-level LIMIT)
  getHeroVideo(lang?: string): Promise<VideoWithLocalizedRelations | null>;
  getRecentVideos(limit: number, lang?: string): Promise<VideoWithLocalizedRelations[]>;
  getVideosByCategory(categoryId: string, limit: number, lang?: string): Promise<VideoWithLocalizedRelations[]>;
  getTrendingVideos(limit: number, lang?: string): Promise<VideoWithLocalizedRelations[]>;
  
  // Hero Videos
  getHeroVideos(): Promise<HeroVideoWithVideo[]>;
  updateHeroVideos(heroVideos: InsertHeroVideo[]): Promise<HeroVideoWithVideo[]>;
  
  // Shorts (YouTube Shorts and TikTok)
  getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number; lang?: string }): Promise<VideoWithLocalizedRelations[]>;

  // Categories (localized)
  createCategory(base: InsertCategory, translations: InsertCategoryTranslation[]): Promise<LocalizedCategory>;
  getLocalizedCategory(id: string, lang: string): Promise<LocalizedCategory | undefined>;
  getLocalizedCategoryBySlug(slug: string, lang: string): Promise<LocalizedCategory | undefined>;
  getAllLocalizedCategories(lang: string): Promise<LocalizedCategory[]>;
  updateLocalizedCategory(id: string, lang: string, data: Partial<CategoryTranslation>): Promise<CategoryTranslation | undefined>;
  deleteCategory(id: string): Promise<void>;
  addCategoryTranslation(categoryId: string, translation: InsertCategoryTranslation): Promise<CategoryTranslation>;
  deleteCategoryTranslation(categoryId: string, lang: string): Promise<void>;
  getCategoryWithAllTranslations(id: string): Promise<(Category & { translations: CategoryTranslation[] }) | undefined>;
  getAllCategoriesWithTranslations(): Promise<(Category & { translations: CategoryTranslation[] })[]>;

  // Tags (localized)
  createTag(base: InsertTag, translations: InsertTagTranslation[]): Promise<LocalizedTag>;
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

  // Utilities
  updateAllVideoThumbnails(): Promise<number>;
  incrementVideoViews(videoId: string, count: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  /**
   * Creates a new channel in the database
   * 
   * This method inserts a new channel record and invalidates the channels cache
   * to ensure fresh data is fetched on subsequent requests.
   * 
   * @param insertChannel - The channel data to insert
   * @returns Promise resolving to the created Channel object
   * 
   * @example
   * ```typescript
   * const newChannel = await storage.createChannel({
   *   name: "Tech Channel",
   *   url: "https://youtube.com/techchannel",
   *   platform: "youtube"
   * });
   * ```
   */
  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await db
      .insert(channels)
      .values(insertChannel)
      .returning();
    cache.invalidate("channels:all");
    return channel;
  }

  /**
   * Retrieves a channel by its ID from the database
   * 
   * This method performs a direct lookup of a channel by its unique identifier.
   * It does not use caching to ensure the most current data is returned.
   * 
   * @param id - The unique identifier of the channel to retrieve
   * @returns Promise resolving to the Channel object if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const channel = await storage.getChannel("channel-uuid");
   * if (channel) {
   *   console.log(`Found channel: ${channel.name}`);
   * }
   * ```
   */
  async getChannel(id: string): Promise<Channel | undefined> {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, id));
    return channel || undefined;
  }

  /**
   * Retrieves all channels from the database with caching
   * 
   * This method fetches all channels and implements caching to improve performance.
   * The cache TTL is configurable through system settings and defaults to 10 minutes.
   * 
   * @returns Promise resolving to an array of all Channel objects
   * 
   * @example
   * ```typescript
   * const allChannels = await storage.getAllChannels();
   * console.log(`Found ${allChannels.length} channels`);
   * ```
   */
  async getAllChannels(): Promise<Channel[]> {
    const cacheKey = "channels:all";
    const cached = cache.get<Channel[]>(cacheKey);
    if (cached) return cached;

    const result = await db.select().from(channels);
    const settings = await getCacheSettings();
    cache.set(cacheKey, result, settings.channelsTTL);
    return result;
  }

  /**
   * Updates an existing channel with new data
   * 
   * This method performs a partial update of a channel record, allowing for
   * selective field updates. It invalidates the channels cache to ensure
   * subsequent requests get fresh data.
   * 
   * @param id - The unique identifier of the channel to update
   * @param data - Partial Channel object containing fields to update
   * @returns Promise resolving to the updated Channel object, or undefined if not found
   * 
   * @example
   * ```typescript
   * const updatedChannel = await storage.updateChannel("channel-uuid", {
   *   name: "Updated Channel Name",
   *   thumbnailUrl: "https://example.com/new-thumbnail.jpg"
   * });
   * ```
   */
  async updateChannel(
    id: string,
    data: Partial<Channel>,
  ): Promise<Channel | undefined> {
    const [channel] = await db
      .update(channels)
      .set(data)
      .where(eq(channels.id, id))
      .returning();
    cache.invalidate("channels:all");
    return channel || undefined;
  }

  /**
   * Deletes a channel and all related data from the database
   * 
   * This method removes a channel record and automatically cascades to delete
   * all associated videos due to foreign key constraints. It also invalidates
   * the channels cache to reflect the deletion.
   * 
   * @param id - The unique identifier of the channel to delete
   * @returns Promise that resolves when the deletion is complete
   * 
   * @example
   * ```typescript
   * await storage.deleteChannel("channel-uuid");
   * console.log("Channel deleted successfully");
   * ```
   */
  async deleteChannel(id: string): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
    cache.invalidate("channels:all");
  }

  /**
   * Retrieves channels filtered by platform with caching
   * 
   * This method fetches channels for a specific platform (e.g., "youtube" or "tiktok")
   * and implements caching to improve performance. Each platform has its own cache key.
   * 
   * @param platform - The platform to filter channels by ("youtube" or "tiktok")
   * @returns Promise resolving to an array of Channel objects for the specified platform
   * 
   * @example
   * ```typescript
   * const youtubeChannels = await storage.getChannelsByPlatform("youtube");
   * console.log(`Found ${youtubeChannels.length} YouTube channels`);
   * ```
   */
  async getChannelsByPlatform(platform: string): Promise<Channel[]> {
    const cacheKey = `channels:platform:${platform}`;
    const cached = cache.get<Channel[]>(cacheKey);
    if (cached) return cached;

    const result = await db.select().from(channels).where(eq(channels.platform, platform));
    const settings = await getCacheSettings();
    cache.set(cacheKey, result, settings.channelsTTL);
    return result;
  }

  // Videos
  /**
   * Creates a new video in the database
   * 
   * This method inserts a new video record and invalidates all video-related
   * cache entries to ensure fresh data is fetched on subsequent requests.
   * 
   * @param insertVideo - The video data to insert
   * @returns Promise resolving to the created Video object
   * 
   * @example
   * ```typescript
   * const newVideo = await storage.createVideo({
   *   channelId: "channel-uuid",
   *   videoId: "youtube-video-id",
   *   title: "My Video Title",
   *   description: "Video description"
   * });
   * ```
   */
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values(insertVideo).returning();
    cache.invalidatePattern("videos:");
    return video;
  }

  /**
   * Retrieves a video by its ID from the database
   * 
   * This method performs a direct lookup of a video by its unique identifier.
   * It does not use caching to ensure the most current data is returned.
   * 
   * @param id - The unique identifier of the video to retrieve
   * @returns Promise resolving to the Video object if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const video = await storage.getVideo("video-uuid");
   * if (video) {
   *   console.log(`Found video: ${video.title}`);
   * }
   * ```
   */
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  /**
   * Retrieves a video by its slug from the database
   * 
   * This method performs a direct lookup of a video by its SEO-friendly slug.
   * It does not use caching to ensure the most current data is returned.
   * 
   * @param slug - The SEO-friendly slug of the video to retrieve
   * @returns Promise resolving to the Video object if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const video = await storage.getVideoBySlug("my-video-title");
   * if (video) {
   *   console.log(`Found video: ${video.title}`);
   * }
   * ```
   */
  async getVideoBySlug(slug: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.slug, slug));
    return video || undefined;
  }

  /**
   * Retrieves a video with its associated channel, tags, and categories with localization support
   * 
   * This method fetches a video by ID and enriches it with related data including
   * the channel information, associated tags, and categories in the specified language.
   * This is useful for displaying complete video information on detail pages with
   * proper localization.
   * 
   * @param id - The unique identifier of the video to retrieve
   * @param lang - The language code for localized content (default: 'en')
   * @returns Promise resolving to a VideoWithLocalizedRelations object if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const videoWithRelations = await storage.getVideoWithRelations("video-uuid", "sr-Latn");
   * if (videoWithRelations) {
   *   console.log(`Video: ${videoWithRelations.title}`);
   *   console.log(`Channel: ${videoWithRelations.channel.name}`);
   *   console.log(`Tags: ${videoWithRelations.tags.length}`);
   *   console.log(`Categories: ${videoWithRelations.categories.length}`);
   * }
   * ```
   */
  async getVideoWithRelations(
    id: string, lang: string = 'en'
  ): Promise<VideoWithLocalizedRelations | undefined> {
    const video = await this.getVideo(id);
    if (!video) return undefined;

    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.id, video.channelId));
    
    const videoTags = await this.getLocalizedTagsByVideoId(video.id, lang);

    const videoCats = await db
      .select({ categoryId: videoCategories.categoryId })
      .from(videoCategories)
      .where(eq(videoCategories.videoId, video.id)) as { categoryId: string }[];

    const categoryIds = videoCats.map((vc: { categoryId: string }) => vc.categoryId);
    const cats = categoryIds.length > 0
      ? await Promise.all(categoryIds.map(cid => this.getLocalizedCategory(cid, lang)))
      : [];

    return {
      ...video,
      channel: channel[0],
      tags: videoTags,
      categories: cats.filter(Boolean) as LocalizedCategory[],
    };
  }

  /**
   * Retrieves a video with its associated channel, tags, and categories by slug with localization support
   * 
   * This method fetches a video by its SEO-friendly slug and enriches it with related data including
   * the channel information, associated tags, and categories in the specified language.
   * This is useful for displaying complete video information on detail pages with proper localization.
   * 
   * @param slug - The SEO-friendly slug of the video to retrieve
   * @param lang - The language code for localized content (default: 'en')
   * @returns Promise resolving to a VideoWithLocalizedRelations object if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const videoWithRelations = await storage.getVideoWithRelationsBySlug("my-video-title", "sr-Latn");
   * if (videoWithRelations) {
   *   console.log(`Video: ${videoWithRelations.title}`);
   *   console.log(`Channel: ${videoWithRelations.channel.name}`);
   *   console.log(`Tags: ${videoWithRelations.tags.length}`);
   *   console.log(`Categories: ${videoWithRelations.categories.length}`);
   * }
   * ```
   */
  async getVideoWithRelationsBySlug(
    slug: string, lang: string = 'en'
  ): Promise<VideoWithLocalizedRelations | undefined> {
    const video = await this.getVideoBySlug(slug);
    if (!video) return undefined;

    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.id, video.channelId));
    
    const videoTags = await this.getLocalizedTagsByVideoId(video.id, lang);

    const videoCats = await db
      .select({ categoryId: videoCategories.categoryId })
      .from(videoCategories)
      .where(eq(videoCategories.videoId, video.id)) as { categoryId: string }[];

    const categoryIds = videoCats.map((vc) => vc.categoryId);
    const cats = categoryIds.length > 0
      ? await Promise.all(categoryIds.map(cid => this.getLocalizedCategory(cid, lang)))
      : [];

    return {
      ...video,
      channel: channel[0],
      tags: videoTags,
      categories: cats.filter(Boolean) as LocalizedCategory[],
    };
  }

  /**
   * Retrieves all videos with optional filtering and localization support
   * 
   * This method fetches videos with comprehensive filtering options including channel,
   * category, and search terms. Results are cached based on the filter parameters
   * to improve performance. Videos are enriched with related data and localized
   * according to the specified language.
   * 
   * @param filters - Optional filtering criteria
   * @param filters.channelId - Filter videos by channel ID
   * @param filters.categoryId - Filter videos by category ID
   * @param filters.search - Search term to filter videos by title or description
   * @param filters.lang - Language code for localized content (default: 'en')
   * @returns Promise resolving to an array of VideoWithLocalizedRelations objects
   * 
   * @example
   * ```typescript
   * // Get all videos
   * const allVideos = await storage.getAllVideos();
   * 
   * // Get videos for a specific channel
   * const channelVideos = await storage.getAllVideos({ channelId: "channel-uuid" });
   * 
   * // Search for videos with "tutorial" in title or description
   * const searchResults = await storage.getAllVideos({ search: "tutorial" });
   * 
   * // Get videos in Serbian Latin
   * const serbianVideos = await storage.getAllVideos({ lang: "sr-Latn" });
   * ```
   */
  async getAllVideos(filters?: {
    channelId?: string;
    categoryId?: string;
    search?: string;
    lang?: string;
  }): Promise<VideoWithLocalizedRelations[]> {
    const lang = filters?.lang || 'en';
    // Create cache key based on filters
    const cacheKey = `videos:all:${JSON.stringify(filters || {})}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    let query = db.select().from(videos);

    const conditions = [];
    if (filters?.channelId) {
      conditions.push(eq(videos.channelId, filters.channelId));
    }
    if (filters?.search) {
      conditions.push(
        sql`${videos.title} ILIKE ${`%${filters.search}%`} OR ${videos.description} ILIKE ${`%${filters.search}%`}`,
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Sort by publishDate, most recent first
    query = query.orderBy(desc(videos.publishDate)) as any;

    const allVideos = await query;

    // If filtering by category, get videos with that category (use base ID)
    let filteredVideos = allVideos;
    if (filters?.categoryId) {
      const videoCats = await db
      .select({ videoId: videoCategories.videoId })
      .from(videoCategories)
      .where(eq(videoCategories.categoryId, filters.categoryId)) as { videoId: string }[];

    const videoIds = videoCats.map((vc) => vc.videoId);
      filteredVideos = allVideos.filter((v) => videoIds.includes(v.id));
    }

    if (filteredVideos.length === 0) {
      return [];
    }

    // Bulk hydrate with lang
    const videosWithRelations = await Promise.all(
      filteredVideos.map(v => this.getVideoWithRelations(v.id, lang))
    ).then(results => results.filter(Boolean) as VideoWithLocalizedRelations[]);

    // Cache the result using configured TTL
    const settings = await getCacheSettings();
    cache.set(cacheKey, videosWithRelations, settings.videosTTL);
    return videosWithRelations;
  }

  /**
   * Updates an existing video with new data
   * 
   * This method performs a partial update of a video record, allowing for
   * selective field updates. It invalidates all video-related cache entries
   * to ensure subsequent requests get fresh data.
   * 
   * @param id - The unique identifier of the video to update
   * @param data - Partial Video object containing fields to update
   * @returns Promise resolving to the updated Video object, or undefined if not found
   * 
   * @example
   * ```typescript
   * const updatedVideo = await storage.updateVideo("video-uuid", {
   *   title: "Updated Video Title",
   *   description: "Updated description"
   * });
   * ```
   */
  async updateVideo(
    id: string,
    data: Partial<Video>,
  ): Promise<Video | undefined> {
    const [video] = await db
      .update(videos)
      .set(data)
      .where(eq(videos.id, id))
      .returning();
    cache.invalidatePattern("videos:");
    return video || undefined;
  }

  /**
   * Deletes a video and all related data from the database
   * 
   * This method removes a video record and automatically cleans up all associated
   * data including tags, category associations, and playlist entries. It also
   * invalidates all video-related cache entries to reflect the deletion.
   * 
   * @param id - The unique identifier of the video to delete
   * @returns Promise that resolves when the deletion is complete
   * 
   * @example
   * ```typescript
   * await storage.deleteVideo("video-uuid");
   * console.log("Video deleted successfully");
   * ```
   */
  async deleteVideo(id: string): Promise<void> {
    // Clean up related data
    await this.deleteTagsByVideoId(id);
    await this.removeVideoCategories(id);
    await db.delete(playlistVideos).where(eq(playlistVideos.videoId, id));
    
    // Delete the video itself
    await db.delete(videos).where(eq(videos.id, id));
    cache.invalidatePattern("videos:");
  }

  /**
   * Retrieves a video by its external video ID from the database
   * 
   * This method performs a direct lookup of a video by its external identifier
   * (e.g., YouTube video ID or TikTok video ID). It does not use caching to
   * ensure the most current data is returned.
   * 
   * @param videoId - The external video identifier to retrieve (YouTube/TikTok ID)
   * @returns Promise resolving to the Video object if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const video = await storage.getVideoByVideoId("youtube-video-id");
   * if (video) {
   *   console.log(`Found video: ${video.title}`);
   * }
   * ```
   */
  async getVideoByVideoId(videoId: string): Promise<Video | undefined> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.videoId, videoId));
    return video || undefined;
  }

  /**
   * Helper method to hydrate videos with their related data efficiently
   * 
   * This private helper method bulk-fetches related data for multiple videos
   * in a single operation, significantly improving performance compared to
   * individual lookups. It retrieves channels, categories, and tags for all
   * videos in the list with a single database query per data type.
   * 
   * @param videoList - Array of Video objects to hydrate
   * @param lang - Language code for localized content (default: 'en')
   * @returns Promise resolving to an array of VideoWithLocalizedRelations objects
   * 
   * @private
   */
  private async hydrateVideosWithRelations(videoList: Video[], lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    if (videoList.length === 0) return [];

    const videoIds = videoList.map((v) => v.id);
    const channelIds = Array.from(new Set(videoList.map((v) => v.channelId)));

    // Fetch all channels at once
    const allChannels = channelIds.length > 0
      ? await db.select().from(channels).where(inArray(channels.id, channelIds))
      : [];
    const channelMap = new Map(allChannels.map((c) => [c.id, c]));

    // Fetch all video-category relations at once
    const allVideoCats = await db
      .select()
      .from(videoCategories)
      .where(inArray(videoCategories.videoId, videoIds)) as { categoryId: string }[];

    const categoryIdSet = new Set(allVideoCats.map((vc: { categoryId: string }) => vc.categoryId));

    // Get localized categories
    const allCategories = categoryIdSet.size > 0
      ? await Promise.all(Array.from(categoryIdSet).map(cid => this.getLocalizedCategory(cid, lang)))
      : [];
    const categoryMap = new Map(allCategories.filter(Boolean).map((c: LocalizedCategory) => [c.id, c]));

    // Group categories by video ID
    const categoriesByVideoId = new Map<string, LocalizedCategory[]>();
    for (const vc of allVideoCats) {
      if (!categoriesByVideoId.has(vc.videoId)) categoriesByVideoId.set(vc.videoId, []);
      const category = categoryMap.get(vc.categoryId);
      if (category) categoriesByVideoId.get(vc.videoId)!.push(category);
    }

    // Get localized tags per video
    const tagsByVideoId = new Map<string, LocalizedTag[]>();
    for (const videoId of videoIds) {
      const tags = await this.getLocalizedTagsByVideoId(videoId, lang);
      tagsByVideoId.set(videoId, tags);
    }

    return videoList.map((video) => {
      const channel = channelMap.get(video.channelId);
      if (!channel) return null as any;
      
      return {
        ...video,
        channel,
        tags: tagsByVideoId.get(video.id) || [],
        categories: categoriesByVideoId.get(video.id) || [],
      };
    }).filter(Boolean) as VideoWithLocalizedRelations[];
  }

  /**
   * Retrieves the most recent video for hero display with localization support
   * 
   * This method fetches the most recently published video for use as the hero
   * banner on the homepage. It implements caching with a 5-minute TTL to
   * improve performance while keeping the content reasonably fresh.
   * 
   * @param lang - Language code for localized content (default: 'en')
   * @returns Promise resolving to a VideoWithLocalizedRelations object or null if no videos exist
   * 
   * @example
   * ```typescript
   * const heroVideo = await storage.getHeroVideo("sr-Latn");
   * if (heroVideo) {
   *   console.log(`Hero video: ${heroVideo.title}`);
   * }
   * ```
   */
  async getHeroVideo(lang: string = 'en'): Promise<VideoWithLocalizedRelations | null> {
    const cacheKey = `videos:hero:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations | null>(cacheKey);
    if (cached !== undefined) return cached;

    const [video] = await db
      .select()
      .from(videos)
      .orderBy(desc(videos.publishDate))
      .limit(1);

    if (!video) {
      cache.set(cacheKey, null, 300000);
      return null;
    }

    const hydrated = await this.hydrateVideosWithRelations([video], lang);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated[0] || null, settings.videosTTL);
    return hydrated[0] || null;
  }

  /**
   * Retrieves the most recent videos with localization support
   * 
   * This method fetches the specified number of most recently published videos.
   * It implements caching based on the limit parameter to improve performance
   * while keeping the content reasonably fresh.
   * 
   * @param limit - Maximum number of videos to retrieve
   * @param lang - Language code for localized content (default: 'en')
   * @returns Promise resolving to an array of VideoWithLocalizedRelations objects
   * 
   * @example
   * ```typescript
   * const recentVideos = await storage.getRecentVideos(10, "sr-Latn");
   * console.log(`Found ${recentVideos.length} recent videos`);
   * ```
   */
  async getRecentVideos(limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const cacheKey = `videos:recent:${limit}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    const recentVideos = await db
      .select()
      .from(videos)
      .orderBy(desc(videos.publishDate))
      .limit(limit);

    const hydrated = await this.hydrateVideosWithRelations(recentVideos, lang);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  /**
   * Retrieves videos for a specific category with localization support
   * 
   * This method fetches videos belonging to a specific category, ordered by
   * publication date with a specified limit. It implements caching based on
   * the category ID and limit to improve performance.
   * 
   * @param categoryId - The unique identifier of the category
   * @param limit - Maximum number of videos to retrieve
   * @param lang - Language code for localized content (default: 'en')
   * @returns Promise resolving to an array of VideoWithLocalizedRelations objects
   * 
   * @example
   * ```typescript
   * const categoryVideos = await storage.getVideosByCategory("category-uuid", 20, "sr-Latn");
   * console.log(`Found ${categoryVideos.length} videos in category`);
   * ```
   */
  async getVideosByCategory(categoryId: string, limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const cacheKey = `videos:category:${categoryId}:${limit}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    // Get video IDs for this category with limit
    const videoCats = await db
      .select({ videoId: videoCategories.videoId })
      .from(videoCategories)
      .innerJoin(videos, eq(videos.id, videoCategories.videoId))
      .where(eq(videoCategories.categoryId, categoryId))
      .orderBy(desc(videos.publishDate))
      .limit(limit) as { videoId: string }[];

    if (videoCats.length === 0) {
      cache.set(cacheKey, [], 300000);
      return [];
    }

    const videoIds = videoCats.map((vc: { videoId: string }) => vc.videoId);
    const categoryVideos = await db
      .select()
      .from(videos)
      .where(inArray(videos.id, videoIds))
      .orderBy(desc(videos.publishDate));

    const hydrated = await this.hydrateVideosWithRelations(categoryVideos, lang);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  /**
   * Retrieves trending videos based on popularity metrics with localization support
   * 
   * This method fetches videos sorted by a popularity algorithm that considers
   * external views, internal views, and likes. It excludes short-form content
   * (YouTube Shorts and TikTok videos) to focus on full-length content.
   * 
   * Popularity formula: externalViews * 0.3 + internalViews * 50 + likes * 100
   * 
   * @param limit - Maximum number of videos to retrieve
   * @param lang - Language code for localized content (default: 'en')
   * @returns Promise resolving to an array of VideoWithLocalizedRelations objects
   * 
   * @example
   * ```typescript
   * const trendingVideos = await storage.getTrendingVideos(20, "sr-Latn");
   * console.log(`Found ${trendingVideos.length} trending videos`);
   * ```
   */
  async getTrendingVideos(limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const cacheKey = `videos:trending:${limit}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    // Use SQL to calculate popularity and sort at database level
    // Popularity formula: externalViews * 0.3 + internalViews * 50 + likes * 100
    // viewCount is a string like "1,234 views" - extract numeric part with REGEXP_REPLACE
    const trendingVideos = await db
      .select()
      .from(videos)
      .where(sql`${videos.videoType} NOT IN ('youtube_short', 'tiktok')`)
      .orderBy(
        sql<number>`(
          COALESCE(CAST(NULLIF(REGEXP_REPLACE(${videos.viewCount}, '[^0-9]', '', 'g'), '') AS INTEGER), 0) * 0.3 +
          COALESCE(${videos.internalViewsCount}, 0) * 50 +
          COALESCE(${videos.likesCount}, 0) * 100
        ) DESC`,
        desc(videos.publishDate)
      )
      .limit(limit);

    const hydrated = await this.hydrateVideosWithRelations(trendingVideos, lang);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  /**
   * Retrieves short-form videos (YouTube Shorts/TikTok) with filtering and pagination
   * 
   * This method fetches short-form video content with optional filtering by platform
   * (YouTube Shorts or TikTok) and supports pagination. Results are cached based
   * on the filter parameters to improve performance.
   * 
   * @param filters - Optional filtering and pagination criteria
   * @param filters.type - Filter by video type ("youtube_short" or "tiktok")
   * @param filters.limit - Maximum number of videos to retrieve (default: 50)
   * @param filters.offset - Pagination offset (default: 0)
   * @param filters.lang - Language code for localized content (default: 'en')
   * @returns Promise resolving to an array of VideoWithLocalizedRelations objects
   * 
   * @example
   * ```typescript
   * // Get all short videos
   * const allShorts = await storage.getShorts();
   * 
   * // Get only YouTube Shorts
   * const youtubeShorts = await storage.getShorts({ type: "youtube_short" });
   * 
   * // Get TikTok videos with pagination
   * const tiktokVideos = await storage.getShorts({ 
   *   type: "tiktok", 
   *   limit: 20, 
   *   offset: 40 
   * });
   * ```
   */
  async getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number; lang?: string }): Promise<VideoWithLocalizedRelations[]> {
    const lang = filters?.lang || 'en';
    const type = filters?.type;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    const cacheKey = `videos:shorts:${type || 'all'}:${limit}:${offset}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    let query = db.select().from(videos);
    
    if (type) {
      query = query.where(eq(videos.videoType, type)) as typeof query;
    } else {
      query = query.where(
        sql`${videos.videoType} IN ('youtube_short', 'tiktok')`
      ) as typeof query;
    }
    
    const shortsVideos = await query
      .orderBy(desc(videos.publishDate))
      .limit(limit)
      .offset(offset);

    const hydrated = await this.hydrateVideosWithRelations(shortsVideos, lang);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  /**
   * Retrieves all configured hero videos with associated video data
   * 
   * This method fetches the complete hero video configuration including all
   * 5 slots with their associated video data. Results are cached for 5 minutes
   * to improve performance. The method ensures only valid slots (1-5) are returned.
   * 
   * @returns Promise resolving to an array of HeroVideoWithVideo objects ordered by slot
   * 
   * @example
   * ```typescript
   * const heroVideos = await storage.getHeroVideos();
   * console.log(`Configured ${heroVideos.length} hero videos`);
   * heroVideos.forEach(hv => {
   *   console.log(`Slot ${hv.slot}: ${hv.title}`);
   * });
   * ```
   */
  async getHeroVideos(): Promise<HeroVideoWithVideo[]> {
    const cacheKey = "hero:videos";
    const cached = cache.get<HeroVideoWithVideo[]>(cacheKey);
    if (cached) return cached;

    const heroEntries = await db
      .select({
        id: heroVideos.id,
        slot: heroVideos.slot,
        videoId: heroVideos.videoId,
        title: heroVideos.title,
        description: heroVideos.description,
        buttonText: heroVideos.buttonText,
        buttonLink: heroVideos.buttonLink,
        createdAt: heroVideos.createdAt,
        updatedAt: heroVideos.updatedAt,
        video: videos,
      })
      .from(heroVideos)
      .leftJoin(videos, eq(heroVideos.videoId, videos.id))
      .orderBy(heroVideos.slot);

    const result: HeroVideoWithVideo[] = heroEntries.map(entry => ({
      id: entry.id,
      slot: entry.slot,
      videoId: entry.videoId,
      title: entry.title,
      description: entry.description,
      buttonText: entry.buttonText,
      buttonLink: entry.buttonLink,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      video: entry.video ? {
        ...entry.video,
        channel: null, // Will be hydrated if needed in frontend
        tags: [],
        categories: [],
      } : null,
    })).filter(hv => hv.slot >= 1 && hv.slot <= 5); // Ensure only slots 1-5

    cache.set(cacheKey, result, 300000); // 5 min cache
    return result;
  }

  /**
   * Updates the entire hero video configuration with validation
   * 
   * This method replaces all existing hero video configurations with a new set
   * of exactly 5 hero videos. It performs strict validation to ensure:
   * 1. Exactly 5 entries are provided
   * 2. Slots are unique and numbered 1-5
   * 3. All video IDs reference existing videos
   * 
   * After updating, it invalidates the hero videos cache and returns fresh data
   * by calling getHeroVideos().
   * 
   * @param heroVideos - Array of exactly 5 InsertHeroVideo objects
   * @returns Promise resolving to an array of HeroVideoWithVideo objects
   * @throws Error if validation fails
   * 
   * @example
   * ```typescript
   * const newHeroConfig = [
   *   { slot: 1, videoId: "video1", title: "First Hero", description: "...", buttonText: "Watch", buttonLink: "/videos/1" },
   *   { slot: 2, videoId: "video2", title: "Second Hero", description: "...", buttonText: "View", buttonLink: "/videos/2" },
   *   // ... 3 more entries
   * ];
   * const updatedHeroes = await storage.updateHeroVideos(newHeroConfig);
   * ```
   */
  async updateHeroVideos(heroVideos: InsertHeroVideo[]): Promise<HeroVideoWithVideo[]> {
    // Validation: Exactly 5, unique slots 1-5
    if (heroVideos.length !== 5) {
      throw new Error("Exactly 5 hero videos must be provided.");
    }
    const slots = heroVideos.map(hv => hv.slot);
    const uniqueSlots = new Set(slots);
    if (uniqueSlots.size !== 5 || ![1,2,3,4,5].every(s => uniqueSlots.has(s))) {
      throw new Error("Slots must be unique and exactly 1 through 5.");
    }
    // Validate videoIds exist (optional, but check)
    const videoIds = heroVideos.map(hv => hv.videoId).filter(Boolean);
    if (videoIds.length > 0) {
      const existingVideos = await db.select({id: videos.id}).from(videos).where(inArray(videos.id, videoIds));
      const existingIds = new Set(existingVideos.map(v => v.id));
      for (const vid of videoIds) {
        if (!existingIds.has(vid)) {
          throw new Error(`Invalid video ID: ${vid}`);
        }
      }
    }

    // Delete existing hero videos
    await db.delete(heroVideos);

    // Insert new ones with timestamps
    const inserts = heroVideos.map(hv => ({
      ...hv,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.insert(heroVideos).values(inserts);

    // Invalidate cache and return fresh data
    cache.invalidate("hero:videos");
    return this.getHeroVideos();
  }

  // Categories (localized)
  async createCategory(base: InsertCategory, translations: InsertCategoryTranslation[]): Promise<LocalizedCategory> {
    // Insert base category (no name/slug/desc)
    const [category] = await db
      .insert(categories)
      .values({ ...base, videoCount: 0, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    
    // Insert translations
    const transInserts = translations.map(t => ({ ...t, categoryId: category.id, createdAt: new Date(), updatedAt: new Date() }));
    await db.insert(categoryTranslations).values(transInserts);
    
    cache.invalidate("categories:all");
    cache.invalidatePattern("videos:");
    return this.getLocalizedCategory(category.id, 'en')!; // Return with default lang
  }

  async getLocalizedCategory(id: string, lang: string): Promise<LocalizedCategory | undefined> {
    const base = await db.select().from(categories).where(eq(categories.id, id)).then(r => r[0]);
    if (!base) return undefined;

    // Fetch translation for lang, fallback to 'en'
    let trans = await db.select().from(categoryTranslations)
      .where(and(eq(categoryTranslations.categoryId, id), eq(categoryTranslations.languageCode, lang)))
      .then(r => r[0]);
    
    if (!trans) {
      trans = await db.select().from(categoryTranslations)
        .where(and(eq(categoryTranslations.categoryId, id), eq(categoryTranslations.languageCode, 'en')))
        .then(r => r[0]);
    }

    if (!trans) return undefined; // No translations

    return { ...base, translations: [trans] };
  }

  async getLocalizedCategoryBySlug(slug: string, lang: string): Promise<LocalizedCategory | undefined> {
    // Find translation by slug/lang
    const trans = await db.select().from(categoryTranslations)
      .where(and(eq(categoryTranslations.slug, slug), eq(categoryTranslations.languageCode, lang)))
      .leftJoin(categories, eq(categories.id, categoryTranslations.categoryId))
      .then(r => r[0]);
    
    if (!trans) {
      // Fallback to 'en'
      const fallbackTrans = await db.select().from(categoryTranslations)
        .where(and(eq(categoryTranslations.slug, slug), eq(categoryTranslations.languageCode, 'en')))
        .leftJoin(categories, eq(categories.id, categoryTranslations.categoryId))
        .then(r => r[0]);
      if (!fallbackTrans) return undefined;
      return { ...fallbackTrans.categories, translations: [fallbackTrans.category_translations] };
    }

    return { ...trans.categories, translations: [trans.category_translations] };
  }

  async getAllLocalizedCategories(lang: string): Promise<LocalizedCategory[]> {
    const cacheKey = `categories:localized:${lang}`;
    const cached = cache.get<LocalizedCategory[]>(cacheKey);
    if (cached) return cached;

    // Fetch all bases
    const bases = await db.select().from(categories);

    // Fetch all translations for lang
    const langTrans = await db.select().from(categoryTranslations)
      .where(eq(categoryTranslations.languageCode, lang));

    // Fetch fallback 'en' translations
    const enTrans = await db.select().from(categoryTranslations)
      .where(eq(categoryTranslations.languageCode, 'en'));

    // Map translations
    const transMap = new Map(langTrans.map(t => [t.categoryId, t]));
    const enMap = new Map(enTrans.map(t => [t.categoryId, t]));

    const localized: LocalizedCategory[] = bases.map(base => {
      let trans = transMap.get(base.id);
      if (!trans) trans = enMap.get(base.id);
      return trans ? { ...base, translations: [trans] } : base as any; // Fallback to base if no trans
    });

    const settings = await getCacheSettings();
    cache.set(cacheKey, localized, settings.categoriesTTL);
    return localized;
  }

  async updateLocalizedCategory(id: string, lang: string, data: Partial<CategoryTranslation>): Promise<CategoryTranslation | undefined> {
    const existing = await db.select().from(categoryTranslations)
      .where(and(eq(categoryTranslations.categoryId, id), eq(categoryTranslations.languageCode, lang)))
      .then(r => r[0]);
    
    if (!existing) {
      // Create if not exists
      const [newTrans] = await db.insert(categoryTranslations)
        .values({ ...data, categoryId: id, languageCode: lang, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      cache.invalidate("categories:all");
      return newTrans;
    }

    // Update
    const [updated] = await db.update(categoryTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(categoryTranslations.categoryId, id), eq(categoryTranslations.languageCode, lang)))
      .returning();
    
    cache.invalidate("categories:all");
    cache.invalidatePattern("videos:");
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    // Delete translations first (cascade should handle, but explicit)
    await db.delete(categoryTranslations).where(eq(categoryTranslations.categoryId, id));
    await db.delete(categories).where(eq(categories.id, id));
    // Also remove video relations
    await db.delete(videoCategories).where(eq(videoCategories.categoryId, id));
    cache.invalidate("categories:all");
    cache.invalidatePattern("videos:");
  }

  async addCategoryTranslation(categoryId: string, translation: InsertCategoryTranslation): Promise<CategoryTranslation> {
    const [newTrans] = await db.insert(categoryTranslations)
      .values({ ...translation, categoryId, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    cache.invalidate("categories:all");
    return newTrans;
  }

  async deleteCategoryTranslation(categoryId: string, lang: string): Promise<void> {
    await db.delete(categoryTranslations)
      .where(and(eq(categoryTranslations.categoryId, categoryId), eq(categoryTranslations.languageCode, lang)));
    cache.invalidate("categories:all");
  }

  // Tags (localized)
  async createTag(base: InsertTag, translations: InsertTagTranslation[]): Promise<LocalizedTag> {
    // Insert base tag (no name/slug/desc)
    const [tag] = await db
      .insert(tags)
      .values({ ...base, videoCount: 0, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    
    // Insert translations
    const transInserts = translations.map(t => ({ ...t, tagId: tag.id, createdAt: new Date(), updatedAt: new Date() }));
    await db.insert(tagTranslations).values(transInserts);
    
    return this.getLocalizedTag(tag.id, 'en')!; // Return with default lang
  }

  async getLocalizedTag(id: string, lang: string): Promise<LocalizedTag | undefined> {
    const base = await db.select().from(tags).where(eq(tags.id, id)).then(r => r[0]);
    if (!base) return undefined;

    // Fetch translation for lang, fallback to 'en'
    let trans = await db.select().from(tagTranslations)
      .where(and(eq(tagTranslations.tagId, id), eq(tagTranslations.languageCode, lang)))
      .then(r => r[0]);
    
    if (!trans) {
      trans = await db.select().from(tagTranslations)
        .where(and(eq(tagTranslations.tagId, id), eq(tagTranslations.languageCode, 'en')))
        .then(r => r[0]);
    }

    if (!trans) return undefined;

    return { ...base, translations: [trans] };
  }

  async getLocalizedTagByName(name: string, lang: string): Promise<LocalizedTag | undefined> {
    // Find by name/lang
    const trans = await db.select().from(tagTranslations)
      .where(and(eq(tagTranslations.name, name), eq(tagTranslations.languageCode, lang)))
      .leftJoin(tags, eq(tags.id, tagTranslations.tagId))
      .then(r => r[0]);
    
    if (!trans) {
      // Fallback to 'en'
      const fallbackTrans = await db.select().from(tagTranslations)
        .where(and(eq(tagTranslations.name, name), eq(tagTranslations.languageCode, 'en')))
        .leftJoin(tags, eq(tags.id, tagTranslations.tagId))
        .then(r => r[0]);
      if (!fallbackTrans) return undefined;
      return { ...fallbackTrans.tags, translations: [fallbackTrans.tag_translations] };
    }

    return { ...trans.tags, translations: [trans.tag_translations] };
  }

  async getAllLocalizedTags(lang: string): Promise<LocalizedTag[]> {
    const cacheKey = `tags:localized:${lang}`;
    const cached = cache.get<LocalizedTag[]>(cacheKey);
    if (cached) return cached;

    // Fetch all bases
    const bases = await db.select().from(tags);

    // Fetch all translations for lang
    const langTrans = await db.select().from(tagTranslations)
      .where(eq(tagTranslations.languageCode, lang));

    // Fetch fallback 'en' translations
    const enTrans = await db.select().from(tagTranslations)
      .where(eq(tagTranslations.languageCode, 'en'));

    // Map translations
    const transMap = new Map(langTrans.map(t => [t.tagId, t]));
    const enMap = new Map(enTrans.map(t => [t.tagId, t]));

    const localized: LocalizedTag[] = bases.map(base => {
      let trans = transMap.get(base.id);
      if (!trans) trans = enMap.get(base.id);
      return trans ? { ...base, translations: [trans] } : base as any;
    });

    // Cache for 10 min
    cache.set(cacheKey, localized, 600000);
    return localized;
  }

  async getLocalizedTagsByVideoId(videoId: string, lang: string): Promise<LocalizedTag[]> {
    // First get base tags for video
    const baseTags = await db.select().from(tags).where(eq(tags.videoId, videoId));

    if (baseTags.length === 0) return [];

    const tagIds = baseTags.map(t => t.id);

    // Fetch translations for lang
    let langTrans = await db.select().from(tagTranslations)
      .where(and(inArray(tagTranslations.tagId, tagIds), eq(tagTranslations.languageCode, lang)));

    // If not all have lang trans, fetch 'en' for missing
    const langTransMap = new Map(langTrans.map(t => [t.tagId, t]));
    const missingIds = tagIds.filter(id => !langTransMap.has(id));
    let enTrans: any[] = [];
    if (missingIds.length > 0) {
      enTrans = await db.select().from(tagTranslations)
        .where(and(inArray(tagTranslations.tagId, missingIds), eq(tagTranslations.languageCode, 'en')));
    }

    const localized = baseTags.map(base => {
      let trans = langTransMap.get(base.id) || enTrans.find(e => e.tagId === base.id);
      return trans ? { ...base, translations: [trans] } : base as any;
    });

    return localized;
  }

  async updateLocalizedTag(id: string, lang: string, data: Partial<TagTranslation>): Promise<TagTranslation | undefined> {
    const existing = await db.select().from(tagTranslations)
      .where(and(eq(tagTranslations.tagId, id), eq(tagTranslations.languageCode, lang)))
      .then(r => r[0]);
    
    if (!existing) {
      const [newTrans] = await db.insert(tagTranslations)
        .values({ ...data, tagId: id, languageCode: lang, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newTrans;
    }

    const [updated] = await db.update(tagTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tagTranslations.tagId, id), eq(tagTranslations.languageCode, lang)))
      .returning();
    
    return updated;
  }

  async deleteTag(id: string): Promise<void> {
    await db.delete(tagTranslations).where(eq(tagTranslations.tagId, id));
    await db.delete(tags).where(eq(tags.id, id));
  }

  async addTagTranslation(tagId: string, translation: InsertTagTranslation): Promise<TagTranslation> {
    const [newTrans] = await db.insert(tagTranslations)
      .values({ ...translation, tagId, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return newTrans;
  }

  async deleteTagTranslation(tagId: string, lang: string): Promise<void> {
    await db.delete(tagTranslations)
      .where(and(eq(tagTranslations.tagId, tagId), eq(tagTranslations.languageCode, lang)));
  }

  async deleteTagsByVideoId(videoId: string): Promise<void> {
    const baseTags = await db.select({id: tags.id}).from(tags).where(eq(tags.videoId, videoId));
    const tagIds = baseTags.map(t => t.id);
    if (tagIds.length > 0) {
      await db.delete(tagTranslations).where(inArray(tagTranslations.tagId, tagIds));
      await db.delete(tags).where(eq(tags.videoId, videoId));
    }
  }

  // Video-Category relations
  async addVideoCategory(videoId: string, categoryId: string): Promise<void> {
    await db
      .insert(videoCategories)
      .values({ videoId, categoryId })
      .onConflictDoNothing();
  }

  async removeVideoCategories(videoId: string): Promise<void> {
    await db
      .delete(videoCategories)
      .where(eq(videoCategories.videoId, videoId));
  }

  // Playlists
  async createPlaylist(insertPlaylist: InsertPlaylist): Promise<Playlist> {
    const [playlist] = await db
      .insert(playlists)
      .values(insertPlaylist)
      .returning();
    return playlist;
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, id));
    return playlist || undefined;
  }

  async getPlaylistWithVideos(
    id: string,
  ): Promise<PlaylistWithVideos | undefined> {
    const playlist = await this.getPlaylist(id);
    if (!playlist) return undefined;

    const playlistVideoRecords = await db
      .select({
        videoId: playlistVideos.videoId,
        position: playlistVideos.position,
      })
      .from(playlistVideos)
      .where(eq(playlistVideos.playlistId, id))
      .orderBy(playlistVideos.position);

    const videoIds = playlistVideoRecords.map((pv: any) => pv.videoId);
    const videoData = videoIds.length > 0 ? await this.getAllVideos() : [];

    const videosWithRelations = videoData.filter((v: any) =>
      videoIds.includes(v.id),
    );

    const orderedVideos = playlistVideoRecords
      .map((pv: any) => videosWithRelations.find((v: any) => v.id === pv.videoId))
      .filter((v: any): v is VideoWithRelations => v !== undefined);

    return {
      ...playlist,
      videos: orderedVideos,
    };
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    return db.select().from(playlists);
  }

  async updatePlaylist(
    id: string,
    data: Partial<Playlist>,
  ): Promise<Playlist | undefined> {
    const [playlist] = await db
      .update(playlists)
      .set(data)
      .where(eq(playlists.id, id))
      .returning();
    return playlist || undefined;
  }

  async deletePlaylist(id: string): Promise<void> {
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  async addVideoToPlaylist(
    playlistId: string,
    videoId: string,
    position?: number,
  ): Promise<void> {
    const existingVideos = await this.getPlaylistVideos(playlistId);

    const alreadyExists = existingVideos.some((pv) => pv.videoId === videoId);
    if (alreadyExists) {
      return;
    }

    const nextPosition = position ?? existingVideos.length;

    await db
      .insert(playlistVideos)
      .values({ playlistId, videoId, position: nextPosition });

    await db
      .update(playlists)
      .set({ videoCount: sql`${playlists.videoCount} + 1` })
      .where(eq(playlists.id, playlistId));
  }

  async removeVideoFromPlaylist(
    playlistId: string,
    videoId: string,
  ): Promise<void> {
    await db
      .delete(playlistVideos)
      .where(
        and(
          eq(playlistVideos.playlistId, playlistId),
          eq(playlistVideos.videoId, videoId),
        ),
      );

    await db
      .update(playlists)
      .set({ videoCount: sql`${playlists.videoCount} - 1` })
      .where(eq(playlists.id, playlistId));
  }

  async getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
    return db
      .select()
      .from(playlistVideos)
      .where(eq(playlistVideos.playlistId, playlistId))
      .orderBy(playlistVideos.position);
  }

  // SEO Settings
  async getSeoSettings(): Promise<SeoSettings | undefined> {
    const cacheKey = "seo:settings";
    const cached = cache.get<SeoSettings>(cacheKey);
    if (cached) return cached;

    const [settings] = await db.select().from(seoSettings).limit(1);

    // If no settings exist, create default ones
    if (!settings) {
      const [newSettings] = await db.insert(seoSettings).values({}).returning();
      cache.set(cacheKey, newSettings, 600000); // 10 minutes
      return newSettings;
    }

    cache.set(cacheKey, settings, 600000); // 10 minutes
    return settings;
  }

  async updateSeoSettings(data: Partial<SeoSettings>): Promise<SeoSettings> {
    cache.invalidate("seo:settings");
    
    const current = await this.getSeoSettings();

    if (!current) {
      // Create if doesn't exist
      const [settings] = await db.insert(seoSettings).values(data).returning();
      cache.set("seo:settings", settings, 600000);
      return settings;
    }

    // Update existing
    const [updated] = await db
      .update(seoSettings)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(seoSettings.id, current.id))
      .returning();

    cache.set("seo:settings", updated, 600000);
    return updated;
  }

  async updateAllVideoThumbnails(): Promise<number> {
    const allVideos = await db
      .select({ id: videos.id, videoId: videos.videoId })
      .from(videos);

    for (const video of allVideos) {
      const highQualityThumbnail = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
      await db
        .update(videos)
        .set({ thumbnailUrl: highQualityThumbnail })
        .where(eq(videos.id, video.id));
    }

    return allVideos.length;
  }

  async incrementVideoViews(videoId: string, count: number): Promise<void> {
    await db
      .update(videos)
      .set({ internalViewsCount: sql`${videos.internalViewsCount} + ${count}` })
      .where(eq(videos.id, videoId));
  }

  // Scrape Jobs
  async createScrapeJob(insertJob: InsertScrapeJob): Promise<ScrapeJob> {
    const [job] = await db.insert(scrapeJobs).values(insertJob).returning();
    return job;
  }

  async getScrapeJob(id: string): Promise<ScrapeJob | undefined> {
    const [job] = await db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.id, id));
    return job || undefined;
  }

  async getActiveScrapeJob(): Promise<ScrapeJob | undefined> {
    const [job] = await db
      .select()
      .from(scrapeJobs)
      .where(eq(scrapeJobs.status, "running"))
      .orderBy(sql`${scrapeJobs.startedAt} DESC`)
      .limit(1);
    return job || undefined;
  }

  async updateScrapeJob(
    id: string,
    data: Partial<ScrapeJob>,
  ): Promise<ScrapeJob | undefined> {
    const [job] = await db
      .update(scrapeJobs)
      .set(data)
      .where(eq(scrapeJobs.id, id))
      .returning();
    return job || undefined;
  }

  // Scheduler Settings
  async getSchedulerSettings(): Promise<SchedulerSettings | undefined> {
    const [settings] = await db.select().from(schedulerSettings).limit(1);
    return settings || undefined;
  }

  async updateSchedulerSettings(data: Partial<SchedulerSettings>): Promise<SchedulerSettings> {
    const current = await this.getSchedulerSettings();
    if (!current) {
      const [settings] = await db.insert(schedulerSettings).values(data).returning();
      return settings;
    }
    const [updated] = await db
      .update(schedulerSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schedulerSettings.id, current.id))
      .returning();
    return updated;
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings | undefined> {
    const [settings] = await db.select().from(systemSettings).limit(1);
    return settings || undefined;
  }

  async updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSystemSettings();
    if (!current) {
      const [settings] = await db.insert(systemSettings).values(data).returning();
      return settings;
    }
    const [updated] = await db
      .update(systemSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(systemSettings.id, current.id))
      .returning();
    return updated;
  }

  // Tag Images
  async getTagImage(tagName: string): Promise<TagImage | undefined> {
    const [image] = await db.select().from(tagImages).where(eq(tagImages.tagName, tagName));
    return image || undefined;
  }

  async updateTagImage(data: InsertTagImage): Promise<TagImage> {
    const existing = await this.getTagImage(data.tagName);
    if (existing) {
      const [updated] = await db
        .update(tagImages)
        .set(data)
        .where(eq(tagImages.tagName, data.tagName))
        .returning();
      return updated;
    }
    const [created] = await db.insert(tagImages).values(data).returning();
    return created;
  }

  async deleteTagImage(tagName: string): Promise<void> {
    await db.delete(tagImages).where(eq(tagImages.tagName, tagName));
  }
}

export class MemStorage implements IStorage {
  private channels: Map<string, Channel> = new Map();
  private videos: Map<string, Video> = new Map();
  private categories: Map<string, Category> = new Map();
  private tags: Map<string, Tag> = new Map();
  private videoCategories: Map<string, { videoId: string, categoryId: string }> = new Map();
  private playlists: Map<string, Playlist> = new Map();
  private playlistVideos: Map<string, PlaylistVideo> = new Map();
  private seoSettings: SeoSettings | null = null;
  private scrapeJobs: Map<string, ScrapeJob> = new Map();
  private schedulerSettings: SchedulerSettings | null = null;
  private systemSettings: SystemSettings | null = null;
  private tagImages: Map<string, TagImage> = new Map();

  constructor() {
    // Add some initial categories
    const initialCategories = ["Music", "Gaming", "Tech", "News", "Entertainment", "Education"];
    initialCategories.forEach((name, index) => {
        const id = (index + 1).toString();
        const slug = name.toLowerCase();
        this.categories.set(id, {
            id,
            name,
            slug,
            description: `Videos about ${name}`,
            videoCount: 0,
            createdAt: new Date()
        });
    });

    // Add a default channel
    const channelId = "1";
    this.channels.set(channelId, {
        id: channelId,
        name: "Demo Channel",
        url: "https://youtube.com/demo",
        channelId: "demo",
        thumbnailUrl: "https://placehold.co/100x100",
        videoCount: 1,
        platform: "youtube",
        lastScraped: new Date(),
        createdAt: new Date()
    });

    // Add a default video
    const videoId = "1";
    this.videos.set(videoId, {
        id: videoId,
        channelId: channelId,
        videoId: "demo-video",
        slug: "demo-video",
        title: "Welcome to Nisam Video",
        description: "This is a demo video running on in-memory storage.",
        thumbnailUrl: "https://placehold.co/640x360",
        duration: "00:00",
        viewCount: "1000",
        likesCount: 10,
        internalViewsCount: 5,
        publishDate: new Date().toISOString(),
        videoType: "regular",
        embedUrl: null,
        createdAt: new Date()
    });
  }

  // Channels
  async createChannel(channel: InsertChannel): Promise<Channel> {
    const id = Math.random().toString(36).substr(2, 9);
    const newChannel: Channel = {
        ...channel,
        id,
        videoCount: 0,
        lastScraped: null,
        createdAt: new Date(),
        channelId: channel.channelId || null,
        thumbnailUrl: channel.thumbnailUrl || null
    };
    this.channels.set(id, newChannel);
    return newChannel;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async getAllChannels(): Promise<Channel[]> {
    return Array.from(this.channels.values());
  }

  async updateChannel(id: string, data: Partial<Channel>): Promise<Channel | undefined> {
    const channel = this.channels.get(id);
    if (!channel) return undefined;
    const updated = { ...channel, ...data };
    this.channels.set(id, updated);
    return updated;
  }

  async deleteChannel(id: string): Promise<void> {
    this.channels.delete(id);
  }

  async getChannelsByPlatform(platform: string): Promise<Channel[]> {
    return Array.from(this.channels.values()).filter(c => c.platform === platform);
  }

  // Videos
  async createVideo(video: InsertVideo): Promise<Video> {
    const id = Math.random().toString(36).substr(2, 9);
    const newVideo: Video = {
        ...video,
        id,
        slug: video.slug || null,
        description: video.description || null,
        duration: video.duration || null,
        viewCount: video.viewCount || null,
        likesCount: 0,
        internalViewsCount: 0,
        publishDate: video.publishDate || null,
        videoType: video.videoType || "regular",
        embedUrl: video.embedUrl || null,
        createdAt: new Date()
    };
    this.videos.set(id, newVideo);
    return newVideo;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async getVideoBySlug(slug: string): Promise<Video | undefined> {
    return Array.from(this.videos.values()).find(v => v.slug === slug);
  }

  async getVideoWithRelations(id: string): Promise<VideoWithRelations | undefined> {
    const video = this.videos.get(id);
    if (!video) return undefined;
    
    const channel = this.channels.get(video.channelId)!;
    const tags = await this.getTagsByVideoId(id);
    const videoCats = Array.from(this.videoCategories.values())
        .filter(vc => vc.videoId === id)
        .map(vc => this.categories.get(vc.categoryId)!)
        .filter(Boolean);

    return { ...video, channel, tags, categories: videoCats };
  }

  async getVideoWithRelationsBySlug(slug: string): Promise<VideoWithRelations | undefined> {
    const video = await this.getVideoBySlug(slug);
    if (!video) return undefined;
    return this.getVideoWithRelations(video.id);
  }

  async getAllVideos(filters?: { channelId?: string; categoryId?: string; search?: string }): Promise<VideoWithRelations[]> {
    let videos = Array.from(this.videos.values());
    
    if (filters?.channelId) {
        videos = videos.filter(v => v.channelId === filters.channelId);
    }
    if (filters?.search) {
        const search = filters.search.toLowerCase();
        videos = videos.filter(v => 
            v.title.toLowerCase().includes(search) || 
            (v.description && v.description.toLowerCase().includes(search))
        );
    }
    if (filters?.categoryId) {
        const videoIdsWithCategory = Array.from(this.videoCategories.values())
            .filter(vc => vc.categoryId === filters.categoryId)
            .map(vc => vc.videoId);
        videos = videos.filter(v => videoIdsWithCategory.includes(v.id));
    }

    videos.sort((a, b) => new Date(b.publishDate || 0).getTime() - new Date(a.publishDate || 0).getTime());

    return Promise.all(videos.map(v => this.getVideoWithRelations(v.id) as Promise<VideoWithRelations>));
  }

  async updateVideo(id: string, data: Partial<Video>): Promise<Video | undefined> {
    const video = this.videos.get(id);
    if (!video) return undefined;
    const updated = { ...video, ...data };
    this.videos.set(id, updated);
    return updated;
  }

  async deleteVideo(id: string): Promise<void> {
    this.videos.delete(id);
  }

  async getVideoByVideoId(videoId: string): Promise<Video | undefined> {
    return Array.from(this.videos.values()).find(v => v.videoId === videoId);
  }

  // Limited queries
  async getHeroVideo(): Promise<VideoWithRelations | null> {
    const videos = await this.getAllVideos();
    return videos.length > 0 ? videos[0] : null;
  }

  async getRecentVideos(limit: number): Promise<VideoWithRelations[]> {
    const videos = await this.getAllVideos();
    return videos.slice(0, limit);
  }

  async getVideosByCategory(categoryId: string, limit: number): Promise<VideoWithRelations[]> {
    const videos = await this.getAllVideos({ categoryId });
    return videos.slice(0, limit);
  }

  async getTrendingVideos(limit: number): Promise<VideoWithRelations[]> {
    // Simple sort by likes for demo
    const videos = await this.getAllVideos();
    videos.sort((a, b) => b.likesCount - a.likesCount);
    return videos.slice(0, limit);
  }

  async getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number }): Promise<VideoWithRelations[]> {
    let videos = await this.getAllVideos();
    if (filters?.type) {
        videos = videos.filter(v => v.videoType === filters.type);
    } else {
        videos = videos.filter(v => v.videoType === "youtube_short" || v.videoType === "tiktok");
    }
    return videos.slice(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 50));
  }

  // Categories
  async createCategory(category: InsertCategory): Promise<Category> {
    const id = Math.random().toString(36).substr(2, 9);
    const newCategory: Category = {
        ...category,
        id,
        description: category.description || null,
        videoCount: 0,
        createdAt: new Date()
    };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(c => c.slug === slug);
  }

  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined> {
    const category = this.categories.get(id);
    if (!category) return undefined;
    const updated = { ...category, ...data };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories.delete(id);
  }

  // Tags
  async createTag(tag: InsertTag): Promise<Tag> {
    const id = Math.random().toString(36).substr(2, 9);
    const newTag: Tag = { ...tag, id };
    this.tags.set(id, newTag);
    return newTag;
  }

  async getTagsByVideoId(videoId: string): Promise<Tag[]> {
    return Array.from(this.tags.values()).filter(t => t.videoId === videoId);
  }

  async deleteTagsByVideoId(videoId: string): Promise<void> {
    const tagsToDelete = Array.from(this.tags.values()).filter(t => t.videoId === videoId);
    tagsToDelete.forEach(t => this.tags.delete(t.id));
  }

  // Video-Category
  async addVideoCategory(videoId: string, categoryId: string): Promise<void> {
    const key = `${videoId}-${categoryId}`;
    this.videoCategories.set(key, { videoId, categoryId });
  }

  async removeVideoCategories(videoId: string): Promise<void> {
    for (const [key, val] of this.videoCategories.entries()) {
        if (val.videoId === videoId) {
            this.videoCategories.delete(key);
        }
    }
  }

  // Playlists
  async createPlaylist(playlist: InsertPlaylist): Promise<Playlist> {
    const id = Math.random().toString(36).substr(2, 9);
    const newPlaylist: Playlist = {
        ...playlist,
        id,
        description: playlist.description || null,
        videoCount: 0,
        createdAt: new Date()
    };
    this.playlists.set(id, newPlaylist);
    return newPlaylist;
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    return this.playlists.get(id);
  }

  async getPlaylistWithVideos(id: string): Promise<PlaylistWithVideos | undefined> {
    const playlist = this.playlists.get(id);
    if (!playlist) return undefined;
    const videos = await this.getPlaylistVideos(id);
    const fullVideos = await Promise.all(videos.map(v => this.getVideoWithRelations(v.videoId)));
    return { ...playlist, videos: fullVideos.filter(Boolean) as VideoWithRelations[] };
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    return Array.from(this.playlists.values());
  }

  async updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist | undefined> {
    const playlist = this.playlists.get(id);
    if (!playlist) return undefined;
    const updated = { ...playlist, ...data };
    this.playlists.set(id, updated);
    return updated;
  }

  async deletePlaylist(id: string): Promise<void> {
    this.playlists.delete(id);
  }

  async addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void> {
    const key = `${playlistId}-${videoId}`;
    this.playlistVideos.set(key, { playlistId, videoId, position: position || 0, addedAt: new Date() });
    const playlist = this.playlists.get(playlistId);
    if (playlist) {
        playlist.videoCount++;
        this.playlists.set(playlistId, playlist);
    }
  }

  async removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void> {
    const key = `${playlistId}-${videoId}`;
    if (this.playlistVideos.has(key)) {
        this.playlistVideos.delete(key);
        const playlist = this.playlists.get(playlistId);
        if (playlist) {
            playlist.videoCount--;
            this.playlists.set(playlistId, playlist);
        }
    }
  }

  async getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
    return Array.from(this.playlistVideos.values())
        .filter(pv => pv.playlistId === playlistId)
        .sort((a, b) => a.position - b.position);
  }

  // SEO
  async getSeoSettings(): Promise<SeoSettings | undefined> {
    if (!this.seoSettings) {
        this.seoSettings = {
            id: "1",
            siteName: "Nisam Video",
            siteDescription: "AI-powered video aggregation",
            ogImage: null,
            metaKeywords: null,
            updatedAt: new Date()
        };
    }
    return this.seoSettings;
  }

  async updateSeoSettings(data: Partial<SeoSettings>): Promise<SeoSettings> {
    const current = await this.getSeoSettings();
    this.seoSettings = { ...current!, ...data, updatedAt: new Date() };
    return this.seoSettings;
  }

  // Scrape Jobs
  async createScrapeJob(job: InsertScrapeJob): Promise<ScrapeJob> {
    const id = Math.random().toString(36).substr(2, 9);
    const newJob: ScrapeJob = {
        ...job,
        id,
        currentChannelName: job.currentChannelName || null,
        errorMessage: null,
        completedAt: null,
        startedAt: new Date(),
        status: job.status || "pending",
        totalChannels: job.totalChannels || 0,
        processedChannels: job.processedChannels || 0,
        videosAdded: job.videosAdded || 0
    };
    this.scrapeJobs.set(id, newJob);
    return newJob;
  }

  async getScrapeJob(id: string): Promise<ScrapeJob | undefined> {
    return this.scrapeJobs.get(id);
  }

  async getActiveScrapeJob(): Promise<ScrapeJob | undefined> {
    return Array.from(this.scrapeJobs.values()).find(j => j.status === "running");
  }

  async updateScrapeJob(id: string, data: Partial<ScrapeJob>): Promise<ScrapeJob | undefined> {
    const job = this.scrapeJobs.get(id);
    if (!job) return undefined;
    const updated = { ...job, ...data };
    this.scrapeJobs.set(id, updated);
    return updated;
  }

  async updateAllVideoThumbnails(): Promise<number> {
    return 0;
  }

  async incrementVideoViews(videoId: string, count: number): Promise<void> {
    const video = this.videos.get(videoId);
    if (video) {
      video.internalViewsCount += count;
      this.videos.set(videoId, video);
    }
  }

  // Scheduler Settings
  async getSchedulerSettings(): Promise<SchedulerSettings | undefined> {
    if (!this.schedulerSettings) {
        this.schedulerSettings = {
            id: "1",
            isEnabled: 0,
            intervalHours: 6,
            lastRun: null,
            nextRun: null,
            updatedAt: new Date()
        };
    }
    return this.schedulerSettings;
  }

  async updateSchedulerSettings(data: Partial<SchedulerSettings>): Promise<SchedulerSettings> {
    const current = await this.getSchedulerSettings();
    this.schedulerSettings = { ...current!, ...data, updatedAt: new Date() };
    return this.schedulerSettings;
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings | undefined> {
    if (!this.systemSettings) {
        this.systemSettings = {
            id: "1",
            maintenanceMode: 0,
            maintenanceMessage: null,
            allowRegistration: 0,
            itemsPerPage: 24,
            cacheEnabled: 1,
            cacheVideosTTL: 300,
            cacheChannelsTTL: 600,
            cacheCategoriesTTL: 600,
            cacheApiTTL: 180,
            pwaEnabled: 1,
            aboutPageContent: null,
            customHeadCode: null,
            customBodyStartCode: null,
            customBodyEndCode: null,
            updatedAt: new Date()
        };
    }
    return this.systemSettings;
  }

  async updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSystemSettings();
    this.systemSettings = { ...current!, ...data, updatedAt: new Date() };
    return this.systemSettings;
  }

  // Tag Images
  async getTagImage(tagName: string): Promise<TagImage | undefined> {
    return this.tagImages.get(tagName);
  }

  async updateTagImage(data: InsertTagImage): Promise<TagImage> {
    const id = Math.random().toString(36).substr(2, 9);
    const existing = this.tagImages.get(data.tagName);
    if (existing) {
        const updated = { ...existing, ...data };
        this.tagImages.set(data.tagName, updated);
        return updated;
    }
    const newImage: TagImage = {
        ...data,
        id,
        isAiGenerated: data.isAiGenerated || 0,
        createdAt: new Date()
    };
    this.tagImages.set(data.tagName, newImage);
    return newImage;
  }

  async deleteTagImage(tagName: string): Promise<void> {
    this.tagImages.delete(tagName);
  }
}

export const storage = dbUrl ? new DatabaseStorage() : new MemStorage();
