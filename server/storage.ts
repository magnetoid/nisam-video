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
  type Channel,
  type InsertChannel,
  type Video,
  type InsertVideo,
  type Category,
  type InsertCategory,
  type Tag,
  type InsertTag,
  type VideoWithRelations,
  type Playlist,
  type InsertPlaylist,
  type PlaylistWithVideos,
  type PlaylistVideo,
  type SeoSettings,
  type ScrapeJob,
  type InsertScrapeJob,
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, inArray, sql, desc } from "drizzle-orm";
import { cache } from "./cache";
import { systemSettings } from "@shared/schema";

// Cache settings helper
let cachedSettings: any = null;
let settingsLastFetched = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute

async function getCacheSettings() {
  const now = Date.now();
  if (cachedSettings && now - settingsLastFetched < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }

  const [settings] = await db.select().from(systemSettings).limit(1);
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
  getVideoWithRelations(id: string): Promise<VideoWithRelations | undefined>;
  getVideoWithRelationsBySlug(
    slug: string,
  ): Promise<VideoWithRelations | undefined>;
  getAllVideos(filters?: {
    channelId?: string;
    categoryId?: string;
    search?: string;
  }): Promise<VideoWithRelations[]>;
  updateVideo(id: string, data: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<void>;
  getVideoByVideoId(videoId: string): Promise<Video | undefined>;
  
  // Optimized limited queries (database-level LIMIT)
  getHeroVideo(): Promise<VideoWithRelations | null>;
  getRecentVideos(limit: number): Promise<VideoWithRelations[]>;
  getVideosByCategory(categoryId: string, limit: number): Promise<VideoWithRelations[]>;
  getTrendingVideos(limit: number): Promise<VideoWithRelations[]>;
  
  // Shorts (YouTube Shorts and TikTok)
  getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number }): Promise<VideoWithRelations[]>;

  // Categories
  createCategory(category: InsertCategory): Promise<Category>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  updateCategory(
    id: string,
    data: Partial<Category>,
  ): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;

  // Tags
  createTag(tag: InsertTag): Promise<Tag>;
  getTagsByVideoId(videoId: string): Promise<Tag[]>;
  deleteTagsByVideoId(videoId: string): Promise<void>;

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

  // Utilities
  updateAllVideoThumbnails(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // Channels
  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await db
      .insert(channels)
      .values(insertChannel)
      .returning();
    cache.invalidate("channels:all");
    return channel;
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, id));
    return channel || undefined;
  }

  async getAllChannels(): Promise<Channel[]> {
    const cacheKey = "channels:all";
    const cached = cache.get<Channel[]>(cacheKey);
    if (cached) return cached;

    const result = await db.select().from(channels);
    const settings = await getCacheSettings();
    cache.set(cacheKey, result, settings.channelsTTL);
    return result;
  }

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

  async deleteChannel(id: string): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
    cache.invalidate("channels:all");
  }

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
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values(insertVideo).returning();
    cache.invalidatePattern("videos:");
    return video;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async getVideoBySlug(slug: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.slug, slug));
    return video || undefined;
  }

  async getVideoWithRelations(
    id: string,
  ): Promise<VideoWithRelations | undefined> {
    const video = await this.getVideo(id);
    if (!video) return undefined;

    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.id, video.channelId));
    const videoTags = await this.getTagsByVideoId(video.id);

    const videoCats = await db
      .select({ categoryId: videoCategories.categoryId })
      .from(videoCategories)
      .where(eq(videoCategories.videoId, video.id));

    const categoryIds = videoCats.map((vc) => vc.categoryId);
    const cats =
      categoryIds.length > 0
        ? await db
            .select()
            .from(categories)
            .where(inArray(categories.id, categoryIds))
        : [];

    return {
      ...video,
      channel: channel[0],
      tags: videoTags,
      categories: cats,
    };
  }

  async getVideoWithRelationsBySlug(
    slug: string,
  ): Promise<VideoWithRelations | undefined> {
    const video = await this.getVideoBySlug(slug);
    if (!video) return undefined;

    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.id, video.channelId));
    const videoTags = await this.getTagsByVideoId(video.id);

    const videoCats = await db
      .select({ categoryId: videoCategories.categoryId })
      .from(videoCategories)
      .where(eq(videoCategories.videoId, video.id));

    const categoryIds = videoCats.map((vc) => vc.categoryId);
    const cats =
      categoryIds.length > 0
        ? await db
            .select()
            .from(categories)
            .where(inArray(categories.id, categoryIds))
        : [];

    return {
      ...video,
      channel: channel[0],
      tags: videoTags,
      categories: cats,
    };
  }

  async getAllVideos(filters?: {
    channelId?: string;
    categoryId?: string;
    search?: string;
  }): Promise<VideoWithRelations[]> {
    // Create cache key based on filters
    const cacheKey = `videos:all:${JSON.stringify(filters || {})}`;
    const cached = cache.get<VideoWithRelations[]>(cacheKey);
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

    // If filtering by category, get videos with that category
    let filteredVideos = allVideos;
    if (filters?.categoryId) {
      const videoCats = await db
        .select({ videoId: videoCategories.videoId })
        .from(videoCategories)
        .where(eq(videoCategories.categoryId, filters.categoryId));

      const videoIds = videoCats.map((vc) => vc.videoId);
      filteredVideos = allVideos.filter((v) => videoIds.includes(v.id));
    }

    if (filteredVideos.length === 0) {
      return [];
    }

    // OPTIMIZED: Bulk fetch all relations instead of N+1 queries
    const videoIds = filteredVideos.map((v) => v.id);
    const channelIds = Array.from(
      new Set(filteredVideos.map((v) => v.channelId)),
    );

    // Fetch all channels at once
    const allChannels =
      channelIds.length > 0
        ? await db
            .select()
            .from(channels)
            .where(inArray(channels.id, channelIds))
        : [];
    const channelMap = new Map(allChannels.map((c) => [c.id, c]));

    // Fetch all tags at once
    const allTags = await db
      .select()
      .from(tags)
      .where(inArray(tags.videoId, videoIds));
    const tagsByVideoId = new Map<string, Tag[]>();
    for (const tag of allTags) {
      if (!tagsByVideoId.has(tag.videoId)) {
        tagsByVideoId.set(tag.videoId, []);
      }
      tagsByVideoId.get(tag.videoId)!.push(tag);
    }

    // Fetch all video-category relations at once
    const allVideoCats = await db
      .select()
      .from(videoCategories)
      .where(inArray(videoCategories.videoId, videoIds));

    const categoryIdSet = new Set(allVideoCats.map((vc) => vc.categoryId));
    const allCategories =
      categoryIdSet.size > 0
        ? await db
            .select()
            .from(categories)
            .where(inArray(categories.id, Array.from(categoryIdSet)))
        : [];
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    // Group categories by video ID
    const categoriesByVideoId = new Map<string, Category[]>();
    for (const vc of allVideoCats) {
      if (!categoriesByVideoId.has(vc.videoId)) {
        categoriesByVideoId.set(vc.videoId, []);
      }
      const category = categoryMap.get(vc.categoryId);
      if (category) {
        categoriesByVideoId.get(vc.videoId)!.push(category);
      }
    }

    // Map relations to videos
    const videosWithRelations: VideoWithRelations[] = filteredVideos.map(
      (video) => ({
        ...video,
        channel: channelMap.get(video.channelId)!,
        tags: tagsByVideoId.get(video.id) || [],
        categories: categoriesByVideoId.get(video.id) || [],
      }),
    );

    // Cache the result using configured TTL
    const settings = await getCacheSettings();
    cache.set(cacheKey, videosWithRelations, settings.videosTTL);
    return videosWithRelations;
  }

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

  async deleteVideo(id: string): Promise<void> {
    await db.delete(videos).where(eq(videos.id, id));
    cache.invalidatePattern("videos:");
  }

  async getVideoByVideoId(videoId: string): Promise<Video | undefined> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.videoId, videoId));
    return video || undefined;
  }

  // Helper to hydrate videos with relations (reusable for limited queries)
  private async hydrateVideosWithRelations(videoList: Video[]): Promise<VideoWithRelations[]> {
    if (videoList.length === 0) return [];

    const videoIds = videoList.map((v) => v.id);
    const channelIds = Array.from(new Set(videoList.map((v) => v.channelId)));

    // Fetch all channels at once
    const allChannels = channelIds.length > 0
      ? await db.select().from(channels).where(inArray(channels.id, channelIds))
      : [];
    const channelMap = new Map(allChannels.map((c) => [c.id, c]));

    // Fetch all tags at once
    const allTags = await db.select().from(tags).where(inArray(tags.videoId, videoIds));
    const tagsByVideoId = new Map<string, Tag[]>();
    for (const tag of allTags) {
      if (!tagsByVideoId.has(tag.videoId)) tagsByVideoId.set(tag.videoId, []);
      tagsByVideoId.get(tag.videoId)!.push(tag);
    }

    // Fetch all video-category relations at once
    const allVideoCats = await db.select().from(videoCategories).where(inArray(videoCategories.videoId, videoIds));
    const categoryIdSet = new Set(allVideoCats.map((vc) => vc.categoryId));
    const allCategories = categoryIdSet.size > 0
      ? await db.select().from(categories).where(inArray(categories.id, Array.from(categoryIdSet)))
      : [];
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    const categoriesByVideoId = new Map<string, Category[]>();
    for (const vc of allVideoCats) {
      if (!categoriesByVideoId.has(vc.videoId)) categoriesByVideoId.set(vc.videoId, []);
      const category = categoryMap.get(vc.categoryId);
      if (category) categoriesByVideoId.get(vc.videoId)!.push(category);
    }

    return videoList.map((video) => ({
      ...video,
      channel: channelMap.get(video.channelId)!,
      tags: tagsByVideoId.get(video.id) || [],
      categories: categoriesByVideoId.get(video.id) || [],
    }));
  }

  // Optimized: Get hero video with SQL LIMIT 1
  async getHeroVideo(): Promise<VideoWithRelations | null> {
    const cacheKey = "videos:hero";
    const cached = cache.get<VideoWithRelations | null>(cacheKey);
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

    const hydrated = await this.hydrateVideosWithRelations([video]);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated[0] || null, settings.videosTTL);
    return hydrated[0] || null;
  }

  // Optimized: Get recent videos with SQL LIMIT
  async getRecentVideos(limit: number): Promise<VideoWithRelations[]> {
    const cacheKey = `videos:recent:${limit}`;
    const cached = cache.get<VideoWithRelations[]>(cacheKey);
    if (cached) return cached;

    const recentVideos = await db
      .select()
      .from(videos)
      .orderBy(desc(videos.publishDate))
      .limit(limit);

    const hydrated = await this.hydrateVideosWithRelations(recentVideos);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  // Optimized: Get videos by category with SQL LIMIT
  async getVideosByCategory(categoryId: string, limit: number): Promise<VideoWithRelations[]> {
    const cacheKey = `videos:category:${categoryId}:${limit}`;
    const cached = cache.get<VideoWithRelations[]>(cacheKey);
    if (cached) return cached;

    // Get video IDs for this category with limit
    const videoCats = await db
      .select({ videoId: videoCategories.videoId })
      .from(videoCategories)
      .innerJoin(videos, eq(videos.id, videoCategories.videoId))
      .where(eq(videoCategories.categoryId, categoryId))
      .orderBy(desc(videos.publishDate))
      .limit(limit);

    if (videoCats.length === 0) {
      cache.set(cacheKey, [], 300000);
      return [];
    }

    const videoIds = videoCats.map((vc) => vc.videoId);
    const categoryVideos = await db
      .select()
      .from(videos)
      .where(inArray(videos.id, videoIds))
      .orderBy(desc(videos.publishDate));

    const hydrated = await this.hydrateVideosWithRelations(categoryVideos);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  // Optimized: Get trending videos with SQL LIMIT (sorted by popularity)
  async getTrendingVideos(limit: number): Promise<VideoWithRelations[]> {
    const cacheKey = `videos:trending:${limit}`;
    const cached = cache.get<VideoWithRelations[]>(cacheKey);
    if (cached) return cached;

    // Use SQL to calculate popularity and sort at database level
    // Popularity formula: externalViews * 0.3 + internalViews * 50 + likes * 100
    // viewCount is a string like "1,234 views" - extract numeric part with REGEXP_REPLACE
    const trendingVideos = await db
      .select()
      .from(videos)
      .orderBy(
        sql`(
          COALESCE(CAST(NULLIF(REGEXP_REPLACE(${videos.viewCount}, '[^0-9]', '', 'g'), '') AS INTEGER), 0) * 0.3 +
          COALESCE(${videos.internalViewsCount}, 0) * 50 +
          COALESCE(${videos.likesCount}, 0) * 100
        ) DESC`,
        desc(videos.publishDate)
      )
      .limit(limit);

    const hydrated = await this.hydrateVideosWithRelations(trendingVideos);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  async getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number }): Promise<VideoWithRelations[]> {
    const type = filters?.type;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    const cacheKey = `videos:shorts:${type || 'all'}:${limit}:${offset}`;
    const cached = cache.get<VideoWithRelations[]>(cacheKey);
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

    const hydrated = await this.hydrateVideosWithRelations(shortsVideos);
    const settings = await getCacheSettings();
    cache.set(cacheKey, hydrated, settings.videosTTL);
    return hydrated;
  }

  // Categories
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    cache.invalidate("categories:all");
    cache.invalidatePattern("videos:"); // Videos have category relations
    return category;
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug));
    return category || undefined;
  }

  async getAllCategories(): Promise<Category[]> {
    const cacheKey = "categories:all";
    const cached = cache.get<Category[]>(cacheKey);
    if (cached) return cached;

    const result = await db.select().from(categories);
    const settings = await getCacheSettings();
    cache.set(cacheKey, result, settings.categoriesTTL);
    return result;
  }

  async updateCategory(
    id: string,
    data: Partial<Category>,
  ): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    cache.invalidate("categories:all");
    cache.invalidatePattern("videos:"); // Videos have category relations
    return category || undefined;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
    cache.invalidate("categories:all");
    cache.invalidatePattern("videos:"); // Videos have category relations
  }

  // Tags
  async createTag(insertTag: InsertTag): Promise<Tag> {
    const [tag] = await db.insert(tags).values(insertTag).returning();
    return tag;
  }

  async getTagsByVideoId(videoId: string): Promise<Tag[]> {
    return db.select().from(tags).where(eq(tags.videoId, videoId));
  }

  async deleteTagsByVideoId(videoId: string): Promise<void> {
    await db.delete(tags).where(eq(tags.videoId, videoId));
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

    const videoIds = playlistVideoRecords.map((pv) => pv.videoId);
    const videoData = videoIds.length > 0 ? await this.getAllVideos() : [];

    const videosWithRelations = videoData.filter((v) =>
      videoIds.includes(v.id),
    );

    const orderedVideos = playlistVideoRecords
      .map((pv) => videosWithRelations.find((v) => v.id === pv.videoId))
      .filter((v): v is VideoWithRelations => v !== undefined);

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
}

export const storage = new DatabaseStorage();
