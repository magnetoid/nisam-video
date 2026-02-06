import {
  channels,
  videoViews,
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
  heroImages,
  heroSettings,
  categoryTranslations,
  tagTranslations,
  type Channel,
  type InsertChannel,
  type Video,
  type InsertVideo,
  type Category,
  type InsertCategory,
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
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type HeroImage,
  type InsertHeroImage,
  type HeroSettings,
  type InsertHeroSettings,
  analyticsEvents,
  users,
  type User,
  type InsertUser,
  type Tag
} from "../../shared/schema.js";
import { db } from "../db.js";
import { eq, like, and, or, isNull, lte, gte, inArray, sql, desc } from "drizzle-orm";
import { cache } from "../cache.js";
import { invalidateChannelCaches, invalidateVideoContentCaches } from "../cache-invalidation.js";
import { IStorage } from "./types.js";
import { isDbReady } from "../db.js";
import { isEligibleShortsVideo, isShortsChannelUrl } from "../shorts-validation.js";

// Cache settings helper
let cachedSettings: any = null;
let settingsLastFetched = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute

// We need a way to access storage instance for getCacheSettings, 
// but circular dependency prevents direct import. 
// We will pass `this` to getCacheSettings or make it a method of the class.
// For now, I'll make it a private method or helper that accepts storage instance.

export class DatabaseStorage implements IStorage {
  // Helper for cache settings
  private async getCacheSettings() {
    const now = Date.now();
    if (cachedSettings && now - settingsLastFetched < SETTINGS_CACHE_TTL) {
      return cachedSettings;
    }

    if (!isDbReady()) {
      console.warn("Database not ready for cache settings, using defaults");
      cachedSettings = {
        enabled: true,
        videosTTL: 300000, // 5 minutes
        channelsTTL: 600000, // 10 minutes
        categoriesTTL: 600000, // 10 minutes
        apiTTL: 180000, // 3 minutes
      };
      settingsLastFetched = now;
      return cachedSettings;
    }

    // Use internal method to avoid circular dependency
    try {
      const settings = await this.getSystemSettings();
      
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
        throw new Error("No settings found");
      }
    } catch (error) {
      console.warn("Failed to fetch system settings for cache, using defaults:", error);
      // Default values if no settings exist or error occurs
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

  // Users
  async createUser(user: InsertUser): Promise<User> {
    try {
      const [newUser] = await db.insert(users).values(user).returning();
      return newUser;
    } catch (error) {
      console.error(`[storage] createUser failed:`, error);
      throw error; // Mutations should fail loudly
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error(`[storage] getUser failed for id ${id}:`, error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    } catch (error) {
      console.error(`[storage] getUserByUsername failed for ${username}:`, error);
      return undefined;
    }
  }

  /**
   * Creates a new channel in the database
   */
  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    try {
      const [channel] = await db
        .insert(channels)
        .values(insertChannel)
        .returning();
      invalidateChannelCaches();
      return channel;
    } catch (error) {
      console.error(`[storage] createChannel failed:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a channel by its ID from the database
   */
  async getChannel(id: string): Promise<Channel | undefined> {
    try {
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, id));
      return channel || undefined;
    } catch (error) {
      console.error(`[storage] getChannel failed for id ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Retrieves all channels from the database with caching
   */
  async getAllChannels(): Promise<Channel[]> {
    const cacheKey = "channels:all";
    const cached = cache.get<Channel[]>(cacheKey);
    if (cached) return cached;

    try {
      const result = await db.select().from(channels);
      const settings = await this.getCacheSettings();
      cache.set(cacheKey, result, settings.channelsTTL);
      return result;
    } catch (error) {
      console.error("[storage] getAllChannels failed:", error);
      return [];
    }
  }

  /**
   * Updates an existing channel with new data
   */
  async updateChannel(
    id: string,
    data: Partial<Channel>,
  ): Promise<Channel | undefined> {
    try {
      const [channel] = await db
        .update(channels)
        .set(data)
        .where(eq(channels.id, id))
        .returning();
      invalidateChannelCaches();
      return channel || undefined;
    } catch (error) {
      console.error(`[storage] updateChannel failed for id ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Deletes a channel and all related data from the database
   */
  async deleteChannel(id: string): Promise<void> {
    try {
      await db.delete(channels).where(eq(channels.id, id));
      invalidateChannelCaches();
    } catch (error) {
      console.error(`[storage] deleteChannel failed for id ${id}:`, error);
      // Continue, as delete failures shouldn't block
    }
  }

  /**
   * Retrieves channels filtered by platform with caching
   */
  async getChannelsByPlatform(platform: string): Promise<Channel[]> {
    const cacheKey = `channels:platform:${platform}`;
    const cached = cache.get<Channel[]>(cacheKey);
    if (cached) return cached;

    try {
      const result = await db.select().from(channels).where(eq(channels.platform, platform));
      const settings = await this.getCacheSettings();
      cache.set(cacheKey, result, settings.channelsTTL);
      return result;
    } catch (error) {
      console.error(`[storage] getChannelsByPlatform failed for ${platform}:`, error);
      return [];
    }
  }

  // Videos
  /**
   * Creates a new video in the database
   */
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    try {
      const [video] = await db.insert(videos).values(insertVideo).returning();
      invalidateVideoContentCaches();
      return video;
    } catch (error) {
      console.error(`[storage] createVideo failed:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a video by its ID from the database
   */
  async getVideo(id: string): Promise<Video | undefined> {
    try {
      const [video] = await db.select().from(videos).where(eq(videos.id, id));
      return video || undefined;
    } catch (error) {
      console.error(`[storage] getVideo failed for id ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Retrieves a video by its slug from the database
   */
  async getVideoBySlug(slug: string): Promise<Video | undefined> {
    try {
      const [video] = await db.select().from(videos).where(eq(videos.slug, slug));
      return video || undefined;
    } catch (error) {
      console.error(`[storage] getVideoBySlug failed for slug ${slug}:`, error);
      return undefined;
    }
  }

  /**
   * Retrieves a video with its associated channel, tags, and categories with localization support
   */
  async getVideoWithRelations(
    id: string, lang: string = 'en'
  ): Promise<VideoWithLocalizedRelations | undefined> {
    try {
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
    } catch (error) {
      console.error(`[storage] getVideoWithRelations failed for id ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Retrieves a video with its associated channel, tags, and categories by slug with localization support
   */
  async getVideoWithRelationsBySlug(
    slug: string, lang: string = 'en'
  ): Promise<VideoWithLocalizedRelations | undefined> {
    try {
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
    } catch (error) {
      console.error(`[storage] getVideoWithRelationsBySlug failed for slug ${slug}:`, error);
      return undefined;
    }
  }

  /**
   * Retrieves all videos with optional filtering and localization support
   */
  async getAllVideos(filters?: {
    channelId?: string;
    categoryId?: string;
    search?: string;
    tagName?: string;
    lang?: string;
    limit?: number;
    offset?: number;
  }): Promise<VideoWithLocalizedRelations[]> {
    const lang = filters?.lang || 'en';
    const cacheKey = `videos:all:${JSON.stringify(filters || {})}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    try {
      let query = db.select().from(videos).$dynamic();

      const conditions = [];
      if (filters?.channelId) {
        conditions.push(eq(videos.channelId, filters.channelId));
      }
      if (filters?.search) {
        conditions.push(
          sql`${videos.title} ILIKE ${`%${filters.search}%`} OR ${videos.description} ILIKE ${`%${filters.search}%`}`,
        );
      }
      if (filters?.categoryId) {
        const sub = db.select({ videoId: videoCategories.videoId })
          .from(videoCategories)
          .where(eq(videoCategories.categoryId, filters.categoryId));
        conditions.push(inArray(videos.id, sub));
      }
      if (filters?.tagName) {
        const sub = db.select({ videoId: tags.videoId })
          .from(tags)
          .innerJoin(tagTranslations, eq(tags.id, tagTranslations.tagId))
          .where(sql`${tagTranslations.tagName} ILIKE ${filters.tagName}`);
        conditions.push(inArray(videos.id, sub));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.orderBy(desc(videos.publishDate));

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const baseVideos = await query;

      if (baseVideos.length === 0) {
        return [];
      }

      const videosWithRelations = await this.hydrateVideosWithRelations(baseVideos, lang);

      const settings = await this.getCacheSettings();
      cache.set(cacheKey, videosWithRelations, settings.videosTTL);
      return videosWithRelations;
    } catch (error) {
      console.error("[storage] getAllVideos failed:", error);
      return [];
    }
  }

  /**
   * Updates an existing video with new data
   */
  async updateVideo(
    id: string,
    data: Partial<Video>,
  ): Promise<Video | undefined> {
    try {
      const [video] = await db
        .update(videos)
        .set(data)
        .where(eq(videos.id, id))
        .returning();
      invalidateVideoContentCaches();
      return video || undefined;
    } catch (error) {
      console.error(`[storage] updateVideo failed for id ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Deletes a video and all related data from the database
   */
  async deleteVideo(id: string): Promise<void> {
    try {
      // Clean up related data
      await this.deleteTagsByVideoId(id);
      await this.removeVideoCategories(id);
      await db.delete(playlistVideos).where(eq(playlistVideos.videoId, id));
      
      // Delete the video itself
      await db.delete(videos).where(eq(videos.id, id));
      invalidateVideoContentCaches();
    } catch (error) {
      console.error(`[storage] deleteVideo failed for id ${id}:`, error);
      // Continue, as delete failures shouldn't block
    }
  }

  /**
   * Retrieves a video by its external video ID from the database
   */
  async getVideoByVideoId(videoId: string): Promise<Video | undefined> {
    try {
      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.videoId, videoId));
      return video || undefined;
    } catch (error) {
      console.error(`[storage] getVideoByVideoId failed for videoId ${videoId}:`, error);
      return undefined;
    }
  }

  async getVideoIdsByChannel(channelId: string): Promise<string[]> {
    try {
      const rows = await db
        .select({ videoId: videos.videoId })
        .from(videos)
        .where(eq(videos.channelId, channelId));
      return rows.map((r) => r.videoId);
    } catch (error) {
      console.error(`[storage] getVideoIdsByChannel failed for channelId ${channelId}:`, error);
      return [];
    }
  }

  async countVideosByChannel(channelId: string): Promise<number> {
    try {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(videos)
        .where(eq(videos.channelId, channelId));
      return Number(row?.count || 0);
    } catch (error) {
      console.error(`[storage] countVideosByChannel failed for channelId ${channelId}:`, error);
      return 0;
    }
  }

  /**
   * Helper method to hydrate videos with their related data efficiently
   */
  private async hydrateVideosWithRelations(videoList: Video[], lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    if (videoList.length === 0) return [];

    try {
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
        .where(inArray(videoCategories.videoId, videoIds)) as { videoId: string; categoryId: string }[];

      const categoryIdSet = new Set(allVideoCats.map((vc) => vc.categoryId));

      // Get localized categories
      const allCategories = categoryIdSet.size > 0
        ? await Promise.all(Array.from(categoryIdSet).map(cid => this.getLocalizedCategory(cid, lang)))
        : [];
      const categoryMap = new Map(allCategories.filter((c): c is LocalizedCategory => !!c).map(c => [c.id, c]));

      // Group categories by video ID
      const categoriesByVideoId = new Map<string, LocalizedCategory[]>();
      for (const vc of allVideoCats) {
        if (!categoriesByVideoId.has(vc.videoId)) categoriesByVideoId.set(vc.videoId, []);
        const category = categoryMap.get(vc.categoryId);
        if (category) categoriesByVideoId.get(vc.videoId)!.push(category);
      }

      const tagsByVideoId = new Map<string, LocalizedTag[]>();
      const allBaseTags = await db
        .select()
        .from(tags)
        .where(inArray(tags.videoId, videoIds));

      if (allBaseTags.length > 0) {
        const tagIds = allBaseTags.map((t) => t.id);

        const [langTrans, enTrans] = await Promise.all([
          db
            .select()
            .from(tagTranslations)
            .where(and(inArray(tagTranslations.tagId, tagIds), eq(tagTranslations.languageCode, lang))),
          db
            .select()
            .from(tagTranslations)
            .where(and(inArray(tagTranslations.tagId, tagIds), eq(tagTranslations.languageCode, "en"))),
        ]);

        const langMap = new Map(langTrans.map((t) => [t.tagId, t]));
        const enMap = new Map(enTrans.map((t) => [t.tagId, t]));

        for (const base of allBaseTags) {
          const trans = langMap.get(base.id) || enMap.get(base.id);
          const localized: LocalizedTag = trans
            ? ({ ...base, translations: [trans], tagName: trans.tagName } as any)
            : ({ ...base, translations: [], tagName: "" } as any);

          if (!tagsByVideoId.has(base.videoId)) tagsByVideoId.set(base.videoId, []);
          tagsByVideoId.get(base.videoId)!.push(localized);
        }
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
    } catch (error) {
      console.error("[storage] hydrateVideosWithRelations failed:", error);
      return videoList.map(v => ({ ...v, channel: null, tags: [], categories: [] } as any));
    }
  }

  /**
   * Retrieves the most recent video for hero display with localization support
   */
  async getHeroVideo(lang: string = 'en'): Promise<VideoWithLocalizedRelations | null> {
    const cacheKey = `videos:hero:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
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
      const settings = await this.getCacheSettings();
      cache.set(cacheKey, hydrated[0] || null, settings.videosTTL);
      return hydrated[0] || null;
    } catch (error) {
      console.error(`[storage] getHeroVideo failed for lang ${lang}:`, error);
      cache.set(cacheKey, null, 300000);
      return null;
    }
  }

  /**
   * Retrieves the most recent videos with localization support
   */
  async getRecentVideos(limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const cacheKey = `videos:recent:${limit}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    try {
      const recentVideos = await db
        .select()
        .from(videos)
        .orderBy(desc(videos.publishDate))
        .limit(limit);

      const hydrated = await this.hydrateVideosWithRelations(recentVideos, lang);
      const settings = await this.getCacheSettings();
      cache.set(cacheKey, hydrated, settings.videosTTL);
      return hydrated;
    } catch (error) {
      console.error(`[storage] getRecentVideos failed for limit ${limit}, lang ${lang}:`, error);
      return [];
    }
  }

  /**
   * Retrieves videos for a specific category with localization support
   */
  async getVideosByCategory(categoryId: string, limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const cacheKey = `videos:category:${categoryId}:${limit}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    try {
      // Validate inputs
      if (!categoryId || !limit || limit <= 0) {
        console.warn(`[storage] Invalid parameters for getVideosByCategory: categoryId=${categoryId}, limit=${limit}`);
        return [];
      }

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
      const settings = await this.getCacheSettings();
      cache.set(cacheKey, hydrated, settings.videosTTL);
      return hydrated;
    } catch (error) {
      console.error(`[storage] getVideosByCategory failed for categoryId ${categoryId}:`, error);
      cache.set(cacheKey, [], 300000);
      return [];
    }
  }

  /**
   * Retrieves trending videos based on popularity metrics with localization support
   */
  async getTrendingVideos(limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const cacheKey = `videos:trending:${limit}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    try {
      // Use SQL to calculate popularity and sort at database level
      // Popularity formula: externalViews * 0.3 + internalViews * 50 + likes * 100
      // viewCount is a string like "1,234 views" - extract numeric part with REGEXP_REPLACE
      let trendingVideos: Video[] = [];
      
      try {
        trendingVideos = await db
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
      } catch (sqlError) {
        console.warn(`[storage] Advanced trending query failed, falling back to simple recent videos:`, sqlError);
        // Fallback: just get recent non-short videos
        trendingVideos = await db
          .select()
          .from(videos)
          .where(sql`${videos.videoType} NOT IN ('youtube_short', 'tiktok')`)
          .orderBy(desc(videos.publishDate))
          .limit(limit);
      }

      const hydrated = await this.hydrateVideosWithRelations(trendingVideos, lang);
      const settings = await this.getCacheSettings();
      cache.set(cacheKey, hydrated, settings.videosTTL);
      return hydrated;
    } catch (error) {
      console.error(`[storage] getTrendingVideos failed for limit ${limit}:`, error);
      return [];
    }
  }

  /**
   * Retrieves short-form videos (YouTube Shorts/TikTok) with filtering and pagination
   */
  async getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number; lang?: string }): Promise<VideoWithLocalizedRelations[]> {
    const lang = filters?.lang || 'en';
    const type = filters?.type;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    const cacheKey = `videos:shorts:${type || 'all'}:${limit}:${offset}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    try {
      const whereClause =
        type === "tiktok"
          ? eq(videos.videoType, "tiktok")
          : type === "youtube_short"
            ? and(eq(videos.videoType, "youtube_short"), sql`${channels.url} ILIKE '%/shorts%'`)
            : or(
                eq(videos.videoType, "tiktok"),
                and(eq(videos.videoType, "youtube_short"), sql`${channels.url} ILIKE '%/shorts%'`),
              );

      const shortsRows = await db
        .select({ video: videos })
        .from(videos)
        .innerJoin(channels, eq(videos.channelId, channels.id))
        .where(whereClause)
        .orderBy(desc(videos.publishDate))
        .limit(limit)
        .offset(offset);

      const shortsVideos = shortsRows.map((r) => r.video);

      const hydrated = await this.hydrateVideosWithRelations(shortsVideos, lang);
      const validated = hydrated.filter((v) => {
        if (v.videoType !== "youtube_short") return true;
        return isShortsChannelUrl(v.channel?.url) && isEligibleShortsVideo(v);
      });

      const settings = await this.getCacheSettings();
      cache.set(cacheKey, validated, settings.videosTTL);
      return validated;
    } catch (error) {
      console.error("[storage] getShorts failed:", error);
      return [];
    }
  }

  /**
   * Retrieves all configured hero videos (admin view)
   */
  async getHeroVideos(): Promise<HeroVideoWithVideo[]> {
    const cacheKey = "hero:videos:admin";
    const cached = cache.get<HeroVideoWithVideo[]>(cacheKey);
    if (cached) return cached;

    try {
      const heroEntries = await db
        .select({
          id: heroVideos.id,
          displayOrder: heroVideos.displayOrder,
          videoId: heroVideos.videoId,
          title: heroVideos.title,
          description: heroVideos.description,
          buttonText: heroVideos.buttonText,
          buttonLink: heroVideos.buttonLink,
          thumbnailUrl: heroVideos.thumbnailUrl,
          videoUrl: heroVideos.videoUrl,
          duration: heroVideos.duration,
          startDate: heroVideos.startDate,
          endDate: heroVideos.endDate,
          isActive: heroVideos.isActive,
          createdAt: heroVideos.createdAt,
          updatedAt: heroVideos.updatedAt,
          video: videos,
        })
        .from(heroVideos)
        .leftJoin(videos, eq(heroVideos.videoId, videos.id))
        .orderBy(heroVideos.displayOrder);

      const result: HeroVideoWithVideo[] = heroEntries.map(entry => ({
        ...entry,
        video: entry.video ? {
          ...entry.video,
          channel: null as any,
          tags: [],
          categories: [],
        } : null as any,
      }));

      cache.set(cacheKey, result, 60000); // 1 min cache
      return result;
    } catch (error) {
      console.error("[storage] getHeroVideos failed:", error);
      return [];
    }
  }

  /**
   * Retrieves active hero videos for public display
   */
  async getActiveHeroVideos(): Promise<HeroVideoWithVideo[]> {
    const cacheKey = "hero:videos:public";
    const cached = cache.get<HeroVideoWithVideo[]>(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();
      
      // First, try to get admin-selected hero videos
      const heroEntries = await db
        .select({
          id: heroVideos.id,
          displayOrder: heroVideos.displayOrder,
          videoId: heroVideos.videoId,
          title: heroVideos.title,
          description: heroVideos.description,
          buttonText: heroVideos.buttonText,
          buttonLink: heroVideos.buttonLink,
          thumbnailUrl: heroVideos.thumbnailUrl,
          videoUrl: heroVideos.videoUrl,
          duration: heroVideos.duration,
          startDate: heroVideos.startDate,
          endDate: heroVideos.endDate,
          isActive: heroVideos.isActive,
          createdAt: heroVideos.createdAt,
          updatedAt: heroVideos.updatedAt,
          video: videos,
        })
        .from(heroVideos)
        .leftJoin(videos, eq(heroVideos.videoId, videos.id))
        .where(and(
          eq(heroVideos.isActive, 1),
          or(isNull(heroVideos.startDate), lte(heroVideos.startDate, now)),
          or(isNull(heroVideos.endDate), gte(heroVideos.endDate, now))
        ))
        .orderBy(heroVideos.displayOrder);

      let result: HeroVideoWithVideo[] = heroEntries.map(entry => ({
        ...entry,
        video: entry.video ? {
          ...entry.video,
          channel: null as any,
          tags: [],
          categories: [],
        } : null as any,
      }));

      // If no admin-selected hero videos, fall back to analytics-based popular videos
      if (result.length === 0) {
        // 1. Try to get top 5 most viewed videos from the last 7 days (analytics)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const analyticsVideos = await db
          .select({
            video: videos,
            viewCount: sql<number>`count(${videoViews.id})`,
          })
          .from(videos)
          .innerJoin(videoViews, eq(videos.id, videoViews.videoId))
          .where(gte(videoViews.createdAt, sevenDaysAgo))
          .groupBy(videos.id)
          .orderBy(desc(sql`count(${videoViews.id})`))
          .limit(5);

        let selectedVideos = analyticsVideos.map(av => av.video);

        // 2. If not enough analytics data (e.g. < 5 videos), fill with generally trending videos
        if (selectedVideos.length < 5) {
          const excludeIds = selectedVideos.map(v => v.id);
          
          // Use the trending formula but exclude already selected videos
          const fillVideos = await db
            .select()
            .from(videos)
            .where(
              and(
                sql`${videos.videoType} NOT IN ('youtube_short', 'tiktok')`,
                excludeIds.length > 0 ? sql`${videos.id} NOT IN ${excludeIds}` : undefined
              )
            )
            .orderBy(
              sql<number>`(
                COALESCE(CAST(NULLIF(REGEXP_REPLACE(${videos.viewCount}, '[^0-9]', '', 'g'), '') AS INTEGER), 0) * 0.3 +
                COALESCE(${videos.internalViewsCount}, 0) * 50 +
                COALESCE(${videos.likesCount}, 0) * 100
              ) DESC`,
              desc(videos.publishDate)
            )
            .limit(5 - selectedVideos.length);

          selectedVideos = [...selectedVideos, ...fillVideos];
        }

        // 3. Last resort: If still < 5 (e.g. empty DB), fill with latest videos
        if (selectedVideos.length < 5) {
          const excludeIds = selectedVideos.map(v => v.id);
          const latestFill = await db
            .select()
            .from(videos)
            .where(
              excludeIds.length > 0 ? sql`${videos.id} NOT IN ${excludeIds}` : undefined
            )
            .orderBy(desc(videos.createdAt))
            .limit(5 - selectedVideos.length);
            
          selectedVideos = [...selectedVideos, ...latestFill];
        }

        result = selectedVideos.map((video, index) => ({
          id: `fallback-${index}`,
          displayOrder: index,
          videoId: video.id,
          title: video.title,
          description: video.description || "Check out this featured video",
          buttonText: "Watch Now",
          buttonLink: `/video/${video.slug || video.id}`,
          thumbnailUrl: video.thumbnailUrl,
          videoUrl: video.embedUrl,
          duration: null,
          startDate: null,
          endDate: null,
          isActive: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          video: {
            ...video,
            channel: null as any, // Will be hydrated if needed, but here we just need basic info
            tags: [],
            categories: [],
          },
        }));
      }

      cache.set(cacheKey, result, 300000); // 5 min cache
      return result;
    } catch (error) {
      console.error("[storage] getActiveHeroVideos failed:", error);
      cache.set(cacheKey, [], 300000);
      return [];
    }
  }

  async getHomeHeroVideos(limit: number, lang: string = "en"): Promise<VideoWithLocalizedRelations[]> {
    const cacheKey = `home:hero:${limit}:${lang}`;
    const cached = cache.get<VideoWithLocalizedRelations[]>(cacheKey);
    if (cached) return cached;

    try {
      const now = new Date();

      const configured = await db
        .select({ video: videos })
        .from(heroVideos)
        .innerJoin(videos, eq(heroVideos.videoId, videos.id))
        .where(
          and(
            eq(heroVideos.isActive, 1),
            or(isNull(heroVideos.startDate), lte(heroVideos.startDate, now)),
            or(isNull(heroVideos.endDate), gte(heroVideos.endDate, now)),
          ),
        )
        .orderBy(heroVideos.displayOrder)
        .limit(limit);

      let selectedVideos = configured.map((r) => r.video);

      if (selectedVideos.length < limit) {
        const excludeIds = selectedVideos.map((v) => v.id);
        const randomFill = await db
          .select()
          .from(videos)
          .where(
            and(
              sql`${videos.videoType} NOT IN ('youtube_short', 'tiktok')`,
              excludeIds.length > 0 ? sql`${videos.id} NOT IN ${excludeIds}` : undefined,
            ),
          )
          .orderBy(sql`RANDOM()`)
          .limit(limit - selectedVideos.length);

        selectedVideos = [...selectedVideos, ...randomFill];
      }

      const hydrated = await this.hydrateVideosWithRelations(selectedVideos, lang);
      const settings = await this.getCacheSettings();
      cache.set(cacheKey, hydrated, settings.videosTTL);
      return hydrated.slice(0, limit);
    } catch (error) {
      console.error(`[storage] getHomeHeroVideos failed for limit ${limit}, lang ${lang}:`, error);
      return [];
    }
  }

  /**
   * Updates hero video configuration
   */
  async updateHeroVideos(heroVideosList: InsertHeroVideo[]): Promise<HeroVideoWithVideo[]> {
    try {
      await db.delete(heroVideos);

      if (heroVideosList.length > 0) {
        const inserts = heroVideosList.map(hv => ({
          ...hv,
          displayOrder: hv.displayOrder || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        await db.insert(heroVideos).values(inserts);
      }

      cache.invalidate("hero:videos:admin");
      cache.invalidate("hero:videos:public");
      return this.getHeroVideos();
    } catch (error) {
      console.error("[storage] updateHeroVideos failed:", error);
      throw error;
    }
  }

  async getHeroSettings(): Promise<HeroSettings | null> {
    const cacheKey = "hero:settings";
    const cached = cache.get<HeroSettings>(cacheKey);
    if (cached) return cached;

    try {
      const [settings] = await db.select().from(heroSettings).limit(1);
      if (settings) {
        cache.set(cacheKey, settings, 60000); // 1 min
      }
      return settings || null;
    } catch (error) {
      console.error("[storage] getHeroSettings failed:", error);
      return null;
    }
  }

  async updateHeroSettings(data: Partial<HeroSettings>): Promise<HeroSettings> {
    try {
      cache.invalidate("hero:settings");
      let settings = await this.getHeroSettings();
      if (!settings) {
        // Create default
        const [newSettings] = await db.insert(heroSettings).values({
          fallbackImages: sql`[]::jsonb`,
          rotationInterval: 4000,
          animationType: "fade",
          defaultPlaceholderUrl: null,
          enableRandom: true,
          enableImages: true,
          updatedAt: sql`now()`,
        }).returning();
        settings = newSettings;
      } else {
        const [updated] = await db.update(heroSettings)
          .set({ ...data, updatedAt: sql`now()` })
          .where(eq(heroSettings.id, settings.id))
          .returning();
        settings = updated;
      }
      cache.set("hero:settings", settings, 60000);
      return settings;
    } catch (error) {
      console.error("[storage] updateHeroSettings failed:", error);
      throw error;
    }
  }

  async getHeroImages(): Promise<HeroImage[]> {
    const cacheKey = "hero:images:all";
    const cached = cache.get<HeroImage[]>(cacheKey);
    if (cached) return cached;

    try {
      const images = await db.select().from(heroImages)
        .where(eq(heroImages.isActive, true))
        .orderBy(heroImages.createdAt);
      cache.set(cacheKey, images, 60000); // 1 min
      return images;
    } catch (error) {
      console.error("[storage] getHeroImages failed:", error);
      return [];
    }
  }

  async upsertHeroImage(image: InsertHeroImage): Promise<HeroImage> {
    try {
      // Validate URL if provided
      if (image.url) {
        const isValid = await this.validateImageUrl(image.url);
        if (!isValid) {
          console.warn(`[storage] Hero image URL validation failed, saving anyway: ${image.url}`);
        }
      }

      if (image.id) {
        const [updated] = await db.update(heroImages)
          .set({ ...image, updatedAt: sql`now()` })
          .where(eq(heroImages.id, image.id))
          .returning();
        cache.invalidate("hero:images:all");
        return updated;
      } else {
        const [created] = await db.insert(heroImages)
          .values({ ...image, createdAt: sql`now()`, updatedAt: sql`now()` })
          .returning();
        cache.invalidate("hero:images:all");
        return created;
      }
    } catch (error) {
      console.error("[storage] upsertHeroImage failed:", error);
      throw error;
    }
  }

  private async validateImageUrl(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const headResponse = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'nisam-video/1.0' },
      });
      clearTimeout(timeoutId);

      const headContentType = headResponse.headers.get('content-type') || '';
      if (headResponse.ok) {
        if (headContentType.startsWith('image/')) return true;
        if (headContentType) return false;
      }

      if ([403, 405, 415].includes(headResponse.status)) {
        const rangeController = new AbortController();
        const rangeTimeoutId = setTimeout(() => rangeController.abort(), 5000);
        const getResponse = await fetch(url, {
          method: 'GET',
          signal: rangeController.signal,
          headers: {
            'User-Agent': 'nisam-video/1.0',
            Range: 'bytes=0-0',
          },
        });
        clearTimeout(rangeTimeoutId);

        const getContentType = getResponse.headers.get('content-type') || '';
        if (getResponse.ok && getContentType.startsWith('image/')) return true;
        if (getResponse.ok && getContentType) return false;
      }

      return true;
    } catch (error) {
      console.warn(`[storage] Image validation failed for ${url}:`, error);
      return true;
    }
  }

  async getRandomHeroImages(): Promise<{ images: (HeroImage & { isFallback?: boolean })[], settings: HeroSettings } | null> {
    try {
      const settings = await this.getHeroSettings();
      if (!settings) return null;

      let selectedImages: (HeroImage & { isFallback?: boolean })[] = [];

      if (settings.enableImages) {
        const activeImages = await db.select().from(heroImages).where(eq(heroImages.isActive, true));
        if (activeImages.length > 0 && settings.enableRandom) {
          // Random selection using SQL RANDOM()
          const randomImages = await db.select().from(heroImages)
            .where(eq(heroImages.isActive, true))
            .orderBy(sql`RANDOM()`)
            .limit(5);
          selectedImages = randomImages;
        } else {
          // Ordered if not random
          selectedImages = activeImages.slice(0, 5);
        }
      }

      // Pad with fallbacks
      const fallbackList = Array.isArray(settings.fallbackImages) ? [...settings.fallbackImages] : [];
      while (selectedImages.length < 5 && fallbackList.length > 0) {
        const fbUrl = fallbackList.shift()!;
        selectedImages.push({
          id: `fb-${Date.now()}-${Math.random()}`,
          url: fbUrl,
          alt: 'Fallback hero image',
          aspectRatio: '16:9',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          isFallback: true
        });
      }

      // Pad with placeholder
      if (selectedImages.length < 5 && settings.defaultPlaceholderUrl) {
        for (let i = selectedImages.length; i < 5; i++) {
          selectedImages.push({
            id: `ph-${i}`,
            url: settings.defaultPlaceholderUrl,
            alt: 'Default placeholder',
            aspectRatio: '16:9',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            isFallback: true
          });
        }
      }

      return { images: selectedImages, settings };
    } catch (error) {
      console.error("[storage] getRandomHeroImages failed:", error);
      return null;
    }
  }

  // Analytics Events
  async getAnalyticsEvents(): Promise<AnalyticsEvent[]> {
    const cacheKey = "analytics:events";
    const cached = cache.get<AnalyticsEvent[]>(cacheKey);
    if (cached) return cached;

    try {
      const events = await db.select().from(analyticsEvents).where(eq(analyticsEvents.isActive, 1));
      cache.set(cacheKey, events, 300000); // 5 minutes cache
      return events;
    } catch (error) {
      console.error("[storage] getAnalyticsEvents failed:", error);
      return [];
    }
  }

  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    try {
      const [newEvent] = await db
        .insert(analyticsEvents)
        .values({
          ...event,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      cache.invalidate("analytics:events");
      return newEvent;
    } catch (error) {
      console.error(`[storage] createAnalyticsEvent failed:`, error);
      throw error;
    }
  }

  async updateAnalyticsEvent(id: string, event: Partial<AnalyticsEvent>): Promise<AnalyticsEvent | undefined> {
    try {
      const [updatedEvent] = await db
        .update(analyticsEvents)
        .set({ ...event, updatedAt: new Date() })
        .where(eq(analyticsEvents.id, id))
        .returning();

      if (updatedEvent) {
        cache.invalidate("analytics:events");
      }
      return updatedEvent;
    } catch (error) {
      console.error(`[storage] updateAnalyticsEvent failed for id ${id}:`, error);
      return undefined;
    }
  }

  async deleteAnalyticsEvent(id: string): Promise<void> {
    try {
      await db.delete(analyticsEvents).where(eq(analyticsEvents.id, id));
      cache.invalidate("analytics:events");
    } catch (error) {
      console.error(`[storage] deleteAnalyticsEvent failed for id ${id}:`, error);
    }
  }

  // Categories (localized)
  async createCategory(base: InsertCategory, translations: Omit<InsertCategoryTranslation, "categoryId">[]): Promise<LocalizedCategory> {
    try {
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
    } catch (error) {
      console.error("[storage] createCategory failed:", error);
      throw error;
    }
  }

  async getLocalizedCategory(id: string, lang: string): Promise<LocalizedCategory | undefined> {
    try {
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

      return { ...base, translations: [trans], name: trans.name, slug: trans.slug, description: trans.description };
    } catch (error) {
      console.error(`[storage] getLocalizedCategory failed for id ${id}, lang ${lang}:`, error);
      return undefined;
    }
  }

  async getLocalizedCategoryBySlug(slug: string, lang: string): Promise<LocalizedCategory | undefined> {
    try {
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
        return { ...fallbackTrans.categories, translations: [fallbackTrans.category_translations], name: fallbackTrans.category_translations.name, slug: fallbackTrans.category_translations.slug, description: fallbackTrans.category_translations.description };
      }

      return { ...trans.categories, translations: [trans.category_translations], name: trans.category_translations.name, slug: trans.category_translations.slug, description: trans.category_translations.description };
    } catch (error) {
      console.error(`[storage] getLocalizedCategoryBySlug failed for slug ${slug}, lang ${lang}:`, error);
      return undefined;
    }
  }

  async getAllLocalizedCategories(lang: string): Promise<LocalizedCategory[]> {
    const cacheKey = `categories:localized:${lang}`;
    const cached = cache.get<LocalizedCategory[]>(cacheKey);
    if (cached) return cached;

    try {
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
        return trans ? { ...base, translations: [trans], name: trans.name, slug: trans.slug, description: trans.description } : null; 
      }).filter((c): c is LocalizedCategory => c !== null);

      const settings = await this.getCacheSettings();
      cache.set(cacheKey, localized, settings.categoriesTTL);
      return localized;
    } catch (error) {
      console.error(`[storage] getAllLocalizedCategories failed for lang ${lang}:`, error);
      return [];
    }
  }

  async updateLocalizedCategory(id: string, lang: string, data: Partial<CategoryTranslation>): Promise<CategoryTranslation | undefined> {
    try {
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
    } catch (error) {
      console.error(`[storage] updateLocalizedCategory failed for id ${id}, lang ${lang}:`, error);
      return undefined;
    }
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined> {
    try {
      const [updated] = await db
        .update(categories)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning();
      
      if (updated) {
          cache.invalidate("categories:all");
      }
      return updated || undefined;
    } catch (error) {
      console.error(`[storage] updateCategory failed for id ${id}:`, error);
      return undefined;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      // Delete translations first (cascade should handle, but explicit)
      await db.delete(categoryTranslations).where(eq(categoryTranslations.categoryId, id));
      await db.delete(categories).where(eq(categories.id, id));
      // Also remove video relations
      await db.delete(videoCategories).where(eq(videoCategories.categoryId, id));
      cache.invalidate("categories:all");
      cache.invalidatePattern("videos:");
    } catch (error) {
      console.error(`[storage] deleteCategory failed for id ${id}:`, error);
    }
  }

  async addCategoryTranslation(categoryId: string, translation: InsertCategoryTranslation): Promise<CategoryTranslation> {
    try {
      const [newTrans] = await db.insert(categoryTranslations)
        .values({ ...translation, categoryId, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      cache.invalidate("categories:all");
      return newTrans;
    } catch (error) {
      console.error(`[storage] addCategoryTranslation failed for categoryId ${categoryId}:`, error);
      throw error;
    }
  }

  async deleteCategoryTranslation(categoryId: string, lang: string): Promise<void> {
    try {
      await db.delete(categoryTranslations)
        .where(and(eq(categoryTranslations.categoryId, categoryId), eq(categoryTranslations.languageCode, lang)));
      cache.invalidate("categories:all");
    } catch (error) {
      console.error(`[storage] deleteCategoryTranslation failed for categoryId ${categoryId}, lang ${lang}:`, error);
    }
  }

  // Tags (localized)
  async createTag(base: InsertTag, translations: Omit<InsertTagTranslation, "tagId">[]): Promise<LocalizedTag> {
    try {
      // Insert base tag (no name/slug/desc)
      const [tag] = await db
        .insert(tags)
        .values({ ...base, videoCount: 0, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      
      // Insert translations
      const transInserts = translations.map(t => ({ ...t, tagId: tag.id, createdAt: new Date(), updatedAt: new Date() }));
      await db.insert(tagTranslations).values(transInserts);
      
      return this.getLocalizedTag(tag.id, 'en')!; // Return with default lang
    } catch (error) {
      console.error("[storage] createTag failed:", error);
      throw error;
    }
  }

  async getLocalizedTag(id: string, lang: string): Promise<LocalizedTag | undefined> {
    try {
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

      return { ...base, translations: [trans], tagName: trans.tagName };
    } catch (error) {
      console.error(`[storage] getLocalizedTag failed for id ${id}, lang ${lang}:`, error);
      return undefined;
    }
  }

  async getLocalizedTagByName(name: string, lang: string): Promise<LocalizedTag | undefined> {
    try {
      // Find by name/lang
      const trans = await db.select().from(tagTranslations)
        .where(and(eq(tagTranslations.tagName, name), eq(tagTranslations.languageCode, lang)))
        .leftJoin(tags, eq(tags.id, tagTranslations.tagId))
        .then(r => r[0]);
      
      if (!trans) {
        // Fallback to 'en'
        const fallbackTrans = await db.select().from(tagTranslations)
          .where(and(eq(tagTranslations.tagName, name), eq(tagTranslations.languageCode, 'en')))
          .leftJoin(tags, eq(tags.id, tagTranslations.tagId))
          .then(r => r[0]);
        if (!fallbackTrans) return undefined;
        return { ...fallbackTrans.tags, translations: [fallbackTrans.tag_translations] };
      }

      return { ...trans.tags, translations: [trans.tag_translations] };
    } catch (error) {
      console.error(`[storage] getLocalizedTagByName failed for name ${name}, lang ${lang}:`, error);
      return undefined;
    }
  }

  async getAllLocalizedTags(lang: string): Promise<LocalizedTag[]> {
    const cacheKey = `tags:localized:${lang}`;
    const cached = cache.get<LocalizedTag[]>(cacheKey);
    if (cached) return cached;

    try {
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
        return trans ? { ...base, translations: [trans], tagName: trans.tagName } : null;
      }).filter((t): t is LocalizedTag => t !== null);

      // Cache for 10 min
      cache.set(cacheKey, localized, 600000);
      return localized;
    } catch (error) {
      console.error(`[storage] getAllLocalizedTags failed for lang ${lang}:`, error);
      return [];
    }
  }

  async getLocalizedTagsByVideoId(videoId: string, lang: string): Promise<LocalizedTag[]> {
    try {
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
        return trans ? { ...base, translations: [trans], tagName: trans.tagName } : base as any;
      });

      return localized;
    } catch (error) {
      console.error(`[storage] getLocalizedTagsByVideoId failed for videoId ${videoId}:`, error);
      return [];
    }
  }

  async updateLocalizedTag(id: string, lang: string, data: Partial<TagTranslation>): Promise<TagTranslation | undefined> {
    try {
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
    } catch (error) {
      console.error(`[storage] updateLocalizedTag failed for id ${id}, lang ${lang}:`, error);
      return undefined;
    }
  }

  async deleteTag(id: string): Promise<void> {
    try {
      await db.delete(tagTranslations).where(eq(tagTranslations.tagId, id));
      await db.delete(tags).where(eq(tags.id, id));
    } catch (error) {
      console.error(`[storage] deleteTag failed for id ${id}:`, error);
    }
  }

  async addTagTranslation(tagId: string, translation: InsertTagTranslation): Promise<TagTranslation> {
    try {
      const [newTrans] = await db.insert(tagTranslations)
        .values({ ...translation, tagId, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newTrans;
    } catch (error) {
      console.error(`[storage] addTagTranslation failed for tagId ${tagId}:`, error);
      throw error;
    }
  }

  async deleteTagTranslation(tagId: string, lang: string): Promise<void> {
    try {
      await db.delete(tagTranslations)
        .where(and(eq(tagTranslations.tagId, tagId), eq(tagTranslations.languageCode, lang)));
    } catch (error) {
      console.error(`[storage] deleteTagTranslation failed for tagId ${tagId}, lang ${lang}:`, error);
    }
  }

  async deleteTagsByVideoId(videoId: string): Promise<void> {
    try {
      const baseTags = await db.select({id: tags.id}).from(tags).where(eq(tags.videoId, videoId));
      const tagIds = baseTags.map(t => t.id);
      if (tagIds.length > 0) {
        await db.delete(tagTranslations).where(inArray(tagTranslations.tagId, tagIds));
        await db.delete(tags).where(eq(tags.videoId, videoId));
      }
    } catch (error) {
      console.error(`[storage] deleteTagsByVideoId failed for videoId ${videoId}:`, error);
    }
  }

  async getTagWithAllTranslations(id: string): Promise<(Tag & { translations: TagTranslation[] }) | undefined> {
    try {
      const base = await db.select().from(tags).where(eq(tags.id, id)).then(r => r[0]);
      if (!base) return undefined;
      const trans = await db.select().from(tagTranslations).where(eq(tagTranslations.tagId, id));
      return { ...base, translations: trans };
    } catch (error) {
      console.error(`[storage] getTagWithAllTranslations failed for id ${id}:`, error);
      return undefined;
    }
  }

  async getAllTagsWithTranslations(): Promise<(Tag & { translations: TagTranslation[] })[]> {
    try {
      const bases = await db.select().from(tags);
      const trans = await db.select().from(tagTranslations);
      const transMap = new Map<string, TagTranslation[]>();
      for (const t of trans) {
        if (!transMap.has(t.tagId)) transMap.set(t.tagId, []);
        transMap.get(t.tagId)!.push(t);
      }
      return bases.map(base => ({ ...base, translations: transMap.get(base.id) || [] }));
    } catch (error) {
      console.error("[storage] getAllTagsWithTranslations failed:", error);
      return [];
    }
  }

  // Video-Category relations
  async addVideoCategory(videoId: string, categoryId: string): Promise<void> {
    try {
      await db
        .insert(videoCategories)
        .values({ videoId, categoryId })
        .onConflictDoNothing();
    } catch (error) {
      console.error(`[storage] addVideoCategory failed for videoId ${videoId}, categoryId ${categoryId}:`, error);
    }
  }

  async removeVideoCategories(videoId: string): Promise<void> {
    try {
      await db
        .delete(videoCategories)
        .where(eq(videoCategories.videoId, videoId));
    } catch (error) {
      console.error(`[storage] removeVideoCategories failed for videoId ${videoId}:`, error);
    }
  }

  // Playlists
  async createPlaylist(insertPlaylist: InsertPlaylist): Promise<Playlist> {
    try {
      const [playlist] = await db
        .insert(playlists)
        .values(insertPlaylist)
        .returning();
      return playlist;
    } catch (error) {
      console.error("[storage] createPlaylist failed:", error);
      throw error;
    }
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    try {
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, id));
      return playlist || undefined;
    } catch (error) {
      console.error(`[storage] getPlaylist failed for id ${id}:`, error);
      return undefined;
    }
  }

  async getPlaylistWithVideos(
    id: string,
  ): Promise<PlaylistWithVideos | undefined> {
    try {
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
    } catch (error) {
      console.error(`[storage] getPlaylistWithVideos failed for id ${id}:`, error);
      return undefined;
    }
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    try {
      return db.select().from(playlists);
    } catch (error) {
      console.error("[storage] getAllPlaylists failed:", error);
      return [];
    }
  }

  async updatePlaylist(
    id: string,
    data: Partial<Playlist>,
  ): Promise<Playlist | undefined> {
    try {
      const [playlist] = await db
        .update(playlists)
        .set(data)
        .where(eq(playlists.id, id))
        .returning();
      return playlist || undefined;
    } catch (error) {
      console.error(`[storage] updatePlaylist failed for id ${id}:`, error);
      return undefined;
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    try {
      await db.delete(playlists).where(eq(playlists.id, id));
    } catch (error) {
      console.error(`[storage] deletePlaylist failed for id ${id}:`, error);
    }
  }

  async addVideoToPlaylist(
    playlistId: string,
    videoId: string,
    position?: number,
  ): Promise<void> {
    try {
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
    } catch (error) {
      console.error(`[storage] addVideoToPlaylist failed for playlistId ${playlistId}, videoId ${videoId}:`, error);
    }
  }

  async removeVideoFromPlaylist(
    playlistId: string,
    videoId: string,
  ): Promise<void> {
    try {
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
    } catch (error) {
      console.error(`[storage] removeVideoFromPlaylist failed for playlistId ${playlistId}, videoId ${videoId}:`, error);
    }
  }

  async getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
    try {
      return db
        .select()
        .from(playlistVideos)
        .where(eq(playlistVideos.playlistId, playlistId))
        .orderBy(playlistVideos.position);
    } catch (error) {
      console.error(`[storage] getPlaylistVideos failed for playlistId ${playlistId}:`, error);
      return [];
    }
  }

  // SEO Settings
  async getSeoSettings(): Promise<SeoSettings | undefined> {
    const cacheKey = "seo:settings";
    const cached = cache.get<SeoSettings>(cacheKey);
    if (cached) return cached;

    try {
      const [settings] = await db.select().from(seoSettings).limit(1);

      // If no settings exist, create default ones
      if (!settings) {
        const [newSettings] = await db.insert(seoSettings).values({}).returning();
        cache.set(cacheKey, newSettings, 600000); // 10 minutes
        return newSettings;
      }

      cache.set(cacheKey, settings, 600000); // 10 minutes
      return settings;
    } catch (error) {
      console.error("[storage] getSeoSettings failed:", error);
      return undefined;
    }
  }

  async updateSeoSettings(data: Partial<SeoSettings>): Promise<SeoSettings> {
    try {
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
    } catch (error) {
      console.error("[storage] updateSeoSettings failed:", error);
      throw error;
    }
  }

  async updateAllVideoThumbnails(): Promise<number> {
    try {
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
    } catch (error) {
      console.error("[storage] updateAllVideoThumbnails failed:", error);
      return 0;
    }
  }

  async incrementVideoViews(videoId: string, count: number): Promise<void> {
    try {
      await db
        .update(videos)
        .set({ internalViewsCount: sql`${videos.internalViewsCount} + ${count}` })
        .where(eq(videos.id, videoId));
    } catch (error) {
      console.error(`[storage] incrementVideoViews failed for videoId ${videoId}:`, error);
    }
  }

  // Scrape Jobs
  async createScrapeJob(insertJob: InsertScrapeJob): Promise<ScrapeJob> {
    try {
      const [job] = await db.insert(scrapeJobs).values(insertJob).returning();
      return job;
    } catch (error) {
      console.error("[storage] createScrapeJob failed:", error);
      throw error;
    }
  }

  async getScrapeJob(id: string): Promise<ScrapeJob | undefined> {
    try {
      const [job] = await db
        .select()
        .from(scrapeJobs)
        .where(eq(scrapeJobs.id, id));
      return job || undefined;
    } catch (error) {
      console.error(`[storage] getScrapeJob failed for id ${id}:`, error);
      return undefined;
    }
  }

  async getActiveScrapeJob(): Promise<ScrapeJob | undefined> {
    try {
      const [job] = await db
        .select()
        .from(scrapeJobs)
        .where(eq(scrapeJobs.status, "running"))
        .orderBy(sql`${scrapeJobs.startedAt} DESC`)
        .limit(1);
      return job || undefined;
    } catch (error) {
      console.error("[storage] getActiveScrapeJob failed:", error);
      return undefined;
    }
  }

  async updateScrapeJob(
    id: string,
    data: Partial<ScrapeJob>,
  ): Promise<ScrapeJob | undefined> {
    try {
      const [job] = await db
        .update(scrapeJobs)
        .set(data)
        .where(eq(scrapeJobs.id, id))
        .returning();
      return job || undefined;
    } catch (error) {
      console.error(`[storage] updateScrapeJob failed for id ${id}:`, error);
      return undefined;
    }
  }

  // Scheduler Settings
  async getSchedulerSettings(): Promise<SchedulerSettings | undefined> {
    try {
      const [settings] = await db.select().from(schedulerSettings).limit(1);
      return settings || undefined;
    } catch (error) {
      console.error("[storage] getSchedulerSettings failed:", error);
      return undefined;
    }
  }

  async updateSchedulerSettings(data: Partial<SchedulerSettings>): Promise<SchedulerSettings> {
    try {
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
    } catch (error) {
      console.error("[storage] updateSchedulerSettings failed:", error);
      throw error;
    }
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings | undefined> {
    try {
      const [settings] = await db.select().from(systemSettings).limit(1);
      return settings || undefined;
    } catch (error) {
      console.error("[storage] getSystemSettings failed:", error);
      return undefined;
    }
  }

  async updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
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
    } catch (error) {
      console.error("[storage] updateSystemSettings failed:", error);
      throw error;
    }
  }

  // Tag Images
  async getTagImage(tagName: string): Promise<TagImage | undefined> {
    try {
      const [image] = await db.select().from(tagImages).where(eq(tagImages.tagName, tagName));
      return image || undefined;
    } catch (error) {
      console.error(`[storage] getTagImage failed for tagName ${tagName}:`, error);
      return undefined;
    }
  }

  async updateTagImage(data: InsertTagImage): Promise<TagImage> {
    try {
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
    } catch (error) {
      console.error(`[storage] updateTagImage failed for tagName ${data.tagName}:`, error);
      throw error;
    }
  }

  async deleteTagImage(tagName: string): Promise<void> {
    try {
      await db.delete(tagImages).where(eq(tagImages.tagName, tagName));
    } catch (error) {
      console.error(`[storage] deleteTagImage failed for tagName ${tagName}:`, error);
    }
  }

  async getCategoryWithAllTranslations(id: string): Promise<(Category & { translations: CategoryTranslation[] }) | undefined> {
    try {
      const base = await db.select().from(categories).where(eq(categories.id, id)).then(r => r[0]);
      if (!base) return undefined;
      const trans = await db.select().from(categoryTranslations).where(eq(categoryTranslations.categoryId, id));
      return { ...base, translations: trans };
    } catch (error) {
      console.error(`[storage] getCategoryWithAllTranslations failed for id ${id}:`, error);
      return undefined;
    }
  }

  async getAllCategoriesWithTranslations(): Promise<(Category & { translations: CategoryTranslation[] })[]> {
    try {
      const bases = await db.select().from(categories);
      const trans = await db.select().from(categoryTranslations);
      const transMap = new Map<string, CategoryTranslation[]>();
      for (const t of trans) {
        if (!transMap.has(t.categoryId)) transMap.set(t.categoryId, []);
        transMap.get(t.categoryId)!.push(t);
      }
      return bases.map(base => ({ ...base, translations: transMap.get(base.id) || [] }));
    } catch (error) {
      console.error("[storage] getAllCategoriesWithTranslations failed:", error);
      return [];
    }
  }

}
