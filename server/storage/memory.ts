import {
  type User,
  type InsertUser,
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
  type Tag
} from "../../shared/schema.js";
import { IStorage } from "./types.js";
import { isEligibleShortsVideo } from "../shorts-validation.js";

export class MemStorage implements IStorage {
  private analyticsEvents: Map<string, AnalyticsEvent> = new Map();
  private users: Map<string, User> = new Map();
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
  private heroVideos: Map<string, HeroVideo> = new Map();

  constructor() {
    // Add some initial categories
    const initialCategories = ["Music", "Gaming", "Tech", "News", "Entertainment", "Education"];
    initialCategories.forEach((name, index) => {
        const id = (index + 1).toString();
        const slug = name.toLowerCase();
        this.categories.set(id, {
            id,
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
        duration: "0", // 00:00
        viewCount: "1000",
        likesCount: 10,
        internalViewsCount: 5,
        publishDate: new Date().toISOString(),
        videoType: "regular",
        embedUrl: null,
        createdAt: new Date()
    });

    // Add a default hero video
    const heroVideoId = "hero-1";
    this.heroVideos.set(heroVideoId, {
        id: heroVideoId,
        videoId: videoId,
        title: "Featured Video",
        description: "Check out our featured content",
        buttonText: "Watch Now",
        buttonLink: "/video/demo-video",
        thumbnailUrl: "https://placehold.co/1280x720",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        duration: 212, // 3:32 in seconds
        displayOrder: 1,
        startDate: null,
        endDate: null,
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date()
    });
  }

  // Users
  async createUser(user: InsertUser): Promise<User> {
    const id = Math.random().toString(36).substr(2, 9);
    const newUser: User = {
        ...user,
        id,
        role: user.role || "user",
        email: user.email || null,
        createdAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
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

  async getVideoWithRelations(id: string, lang: string = 'en'): Promise<VideoWithLocalizedRelations | undefined> {
    const video = this.videos.get(id);
    if (!video) return undefined;
    
    const channel = this.channels.get(video.channelId)!;
    const tags = await this.getLocalizedTagsByVideoId(id, lang);
    const videoCats = Array.from(this.videoCategories.values())
        .filter(vc => vc.videoId === id)
        .map(vc => this.categories.get(vc.categoryId)!)
        .filter(Boolean);

    // Mock localization for categories
    const localizedCats = await Promise.all(videoCats.map(c => this.getLocalizedCategory(c.id, lang)));

    return { 
      ...video, 
      channel, 
      tags, 
      categories: localizedCats.filter(Boolean) as LocalizedCategory[] 
    };
  }

  async getVideoWithRelationsBySlug(slug: string, lang: string = 'en'): Promise<VideoWithLocalizedRelations | undefined> {
    const video = await this.getVideoBySlug(slug);
    if (!video) return undefined;
    return this.getVideoWithRelations(video.id, lang);
  }

  async getAllVideos(filters?: { channelId?: string; categoryId?: string; search?: string; tagName?: string; lang?: string }): Promise<VideoWithLocalizedRelations[]> {
    let videos = Array.from(this.videos.values());
    const lang = filters?.lang || 'en';
    
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

    return Promise.all(videos.map(v => this.getVideoWithRelations(v.id, lang) as Promise<VideoWithLocalizedRelations>));
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
  async getHeroVideo(lang: string = 'en'): Promise<VideoWithLocalizedRelations | null> {
    const videos = await this.getAllVideos({ lang });
    return videos.length > 0 ? videos[0] : null;
  }

  async getRecentVideos(limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const videos = await this.getAllVideos({ lang });
    return videos.slice(0, limit);
  }

  async getVideosByCategory(categoryId: string, limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    const videos = await this.getAllVideos({ categoryId, lang });
    return videos.slice(0, limit);
  }

  async getTrendingVideos(limit: number, lang: string = 'en'): Promise<VideoWithLocalizedRelations[]> {
    // Simple sort by likes for demo
    const videos = await this.getAllVideos({ lang });
    videos.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    return videos.slice(0, limit);
  }

  async getHomeHeroVideos(limit: number, lang: string = "en"): Promise<VideoWithLocalizedRelations[]> {
    const videos = await this.getAllVideos({ lang });
    const candidates = videos.filter(
      (v) => v.videoType !== "youtube_short" && v.videoType !== "tiktok",
    );
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  }

  async getShorts(filters?: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number; lang?: string }): Promise<VideoWithLocalizedRelations[]> {
    let videos = await this.getAllVideos({ lang: filters?.lang });
    if (filters?.type) {
        videos = videos.filter(v => v.videoType === filters.type);
    } else {
        videos = videos.filter(v => v.videoType === "youtube_short" || v.videoType === "tiktok");
    }
    videos = videos.filter((v) => isEligibleShortsVideo(v));
    return videos.slice(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 50));
  }

  // Hero Videos
  async getHeroVideos(): Promise<HeroVideoWithVideo[]> {
    return Array.from(this.heroVideos.values()).map(hero => ({
      ...hero,
      video: hero.videoId ? (this.videos.get(hero.videoId) || null) : null,
    }));
  }

  async getActiveHeroVideos(): Promise<HeroVideoWithVideo[]> {
    const now = new Date();
    
    // First, try to get admin-selected hero videos
    let result = Array.from(this.heroVideos.values())
      .filter(hero => {
        if (!hero.isActive) return false;
        if (hero.startDate && hero.startDate > now) return false;
        if (hero.endDate && hero.endDate < now) return false;
        return true;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(hero => ({
        ...hero,
        video: hero.videoId ? (this.videos.get(hero.videoId) || null) : null,
      }));

    // If no admin-selected hero videos, fall back to 5 random latest videos
    if (result.length === 0) {
      const allVideos = await this.getAllVideos({});
      
      // Get latest 10 videos to randomize from
      const latestVideos = allVideos
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      // Randomly select 5 from the latest 10
      const shuffled = latestVideos.sort(() => 0.5 - Math.random());
      const selectedVideos = shuffled.slice(0, 5);

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
        video: video,
      }));
    }

    return result;
  }

  async updateHeroVideos(heroVideos: InsertHeroVideo[]): Promise<HeroVideoWithVideo[]> {
    // Clear existing hero videos
    this.heroVideos.clear();
    
    // Add new hero videos
    heroVideos.forEach((hv, index) => {
      const id = Math.random().toString(36).substr(2, 9);
      const heroVideo: HeroVideo = {
        ...hv,
        id,
        displayOrder: hv.displayOrder ?? index,
        videoId: hv.videoId || null,
        thumbnailUrl: hv.thumbnailUrl || null,
        videoUrl: hv.videoUrl || null,
        duration: hv.duration || null,
        startDate: hv.startDate || null,
        endDate: hv.endDate || null,
        isActive: hv.isActive ?? 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.heroVideos.set(id, heroVideo);
    });
    
    return this.getHeroVideos();
  }

  // Analytics Events
  async getAnalyticsEvents(): Promise<AnalyticsEvent[]> {
    return Array.from(this.analyticsEvents.values()).filter(event => event.isActive === 1);
  }

  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const id = Math.random().toString(36).substr(2, 9);
    const newEvent: AnalyticsEvent = {
      ...event,
      id,
      selector: event.selector || null,
      parameters: event.parameters || null,
      isActive: event.isActive ?? 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.analyticsEvents.set(id, newEvent);
    return newEvent;
  }

  async updateAnalyticsEvent(id: string, event: Partial<AnalyticsEvent>): Promise<AnalyticsEvent | undefined> {
    const existing = this.analyticsEvents.get(id);
    if (!existing) return undefined;

    const updated: AnalyticsEvent = {
      ...existing,
      ...event,
      updatedAt: new Date(),
    };
    this.analyticsEvents.set(id, updated);
    return updated;
  }

  async deleteAnalyticsEvent(id: string): Promise<void> {
    this.analyticsEvents.delete(id);
  }

  // Categories (localized)
  async createCategory(base: InsertCategory, translations: Omit<InsertCategoryTranslation, "categoryId">[]): Promise<LocalizedCategory> {
    const id = Math.random().toString(36).substr(2, 9);
    const newCategory: Category = {
        ...base,
        id,
        videoCount: 0,
        createdAt: new Date()
    };
    this.categories.set(id, newCategory);
    
    // Store translations (mock storage for them)
    // In a real MemStorage we would need a map for translations
    const fullTranslations = translations.map(t => ({
        ...t,
        categoryId: id,
        id: 'mock-trans-id', // Add mock ID
        createdAt: new Date(),
        updatedAt: new Date()
    })) as CategoryTranslation[];
    
    return {
      ...newCategory,
      translations: fullTranslations
    };
  }

  async getLocalizedCategory(id: string, lang: string): Promise<LocalizedCategory | undefined> {
    const category = this.categories.get(id);
    if (!category) return undefined;
    
    // Mock translation
    return {
      ...category,
      translations: [{
        id: 'mock-trans-id',
        categoryId: category.id,
        languageCode: lang,
        name: 'Mock Category',
        slug: 'mock-category',
        description: 'Mock Description',
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      name: 'Mock Category',
      slug: 'mock-category',
      description: 'Mock Description'
    };
  }

  async getLocalizedCategoryBySlug(slug: string, lang: string): Promise<LocalizedCategory | undefined> {
    // This is hard to implement in MemStorage without a translations map
    // Returning undefined for now or finding by base slug if available?
    // Base categories don't have slugs anymore in the schema, but MemStorage initialized them with slugs.
    // Let's assume MemStorage.categories still has 'slug' for internal use.
    const category = Array.from(this.categories.values()).find(c => (c as any).slug === slug);
    if (!category) return undefined;
    return this.getLocalizedCategory(category.id, lang);
  }

  async getAllLocalizedCategories(lang: string): Promise<LocalizedCategory[]> {
    const categories = Array.from(this.categories.values());
    return Promise.all(categories.map(c => this.getLocalizedCategory(c.id, lang) as Promise<LocalizedCategory>));
  }

  async updateLocalizedCategory(id: string, lang: string, data: Partial<CategoryTranslation>): Promise<CategoryTranslation | undefined> {
    return {
      id: 'mock-id',
      categoryId: id,
      languageCode: lang,
      name: data.name || '',
      slug: data.slug || '',
      description: data.description || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined> {
      const cat = this.categories.get(id);
      if (!cat) return undefined;
      const updated = { ...cat, ...data, updatedAt: new Date() };
      this.categories.set(id, updated);
      return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories.delete(id);
  }

  async addCategoryTranslation(categoryId: string, translation: InsertCategoryTranslation): Promise<CategoryTranslation> {
    return {
      ...translation,
      description: translation.description || null,
      id: 'mock-id',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async deleteCategoryTranslation(categoryId: string, lang: string): Promise<void> {
    // no-op
  }
  
  async getCategoryWithAllTranslations(id: string): Promise<(Category & { translations: CategoryTranslation[] }) | undefined> {
      const cat = this.categories.get(id);
      if (!cat) return undefined;
      return { ...cat, translations: [] };
  }

  async getAllCategoriesWithTranslations(): Promise<(Category & { translations: CategoryTranslation[] })[]> {
      return Array.from(this.categories.values()).map(c => ({ ...c, translations: [] }));
  }

  // Tags (localized)
  async createTag(base: InsertTag, translations: Omit<InsertTagTranslation, "tagId">[]): Promise<LocalizedTag> {
    const id = Math.random().toString(36).substr(2, 9);
    const newTag: Tag = { ...base, id, createdAt: new Date() };
    this.tags.set(id, newTag);
    
    const fullTranslations = translations.map(t => ({
        ...t,
        tagId: id,
        id: 'mock-trans-id',
        createdAt: new Date(),
        updatedAt: new Date()
    })) as TagTranslation[];

    return {
        ...newTag,
        translations: fullTranslations
    };
  }
  
  async getLocalizedTag(id: string, lang: string): Promise<LocalizedTag | undefined> {
      const tag = this.tags.get(id);
      if (!tag) return undefined;
      return {
          ...tag,
          translations: [{
              id: 'mock',
              tagId: id,
              languageCode: lang,
              tagName: 'Mock Tag',
              createdAt: new Date(),
              updatedAt: new Date()
          }]
      };
  }

  async getLocalizedTagByName(name: string, lang: string): Promise<LocalizedTag | undefined> {
      // simplified mock
      return undefined; 
  }

  async getAllLocalizedTags(lang: string): Promise<LocalizedTag[]> {
      return Array.from(this.tags.values()).map(t => ({
          ...t,
          translations: []
      }));
  }

  async getLocalizedTagsByVideoId(videoId: string, lang: string): Promise<LocalizedTag[]> {
    const tags = Array.from(this.tags.values()).filter(t => t.videoId === videoId);
    return tags.map(t => ({
        ...t,
        translations: []
    }));
  }

  async updateLocalizedTag(id: string, lang: string, data: Partial<TagTranslation>): Promise<TagTranslation | undefined> {
      return undefined;
  }

  async deleteTag(id: string): Promise<void> {
      this.tags.delete(id);
  }

  async addTagTranslation(tagId: string, translation: InsertTagTranslation): Promise<TagTranslation> {
      return { ...translation, id: 'mock', createdAt: new Date(), updatedAt: new Date() };
  }

  async deleteTagTranslation(tagId: string, lang: string): Promise<void> {
      // no-op
  }
  
  async deleteTagsByVideoId(videoId: string): Promise<void> {
    const tagsToDelete = Array.from(this.tags.values()).filter(t => t.videoId === videoId);
    tagsToDelete.forEach(t => this.tags.delete(t.id));
  }
  
  async getTagWithAllTranslations(id: string): Promise<(Tag & { translations: TagTranslation[] }) | undefined> {
      const tag = this.tags.get(id);
      if (!tag) return undefined;
      return { ...tag, translations: [] };
  }

  async getAllTagsWithTranslations(): Promise<(Tag & { translations: TagTranslation[] })[]> {
      return Array.from(this.tags.values()).map(t => ({ ...t, translations: [] }));
  }

  // Video-Category
  async addVideoCategory(videoId: string, categoryId: string): Promise<void> {
    const key = `${videoId}-${categoryId}`;
    this.videoCategories.set(key, { videoId, categoryId });
  }

  async removeVideoCategories(videoId: string): Promise<void> {
    for (const [key, val] of Array.from(this.videoCategories.entries())) {
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
            clientErrorLogging: 1,
            aboutPageContent: null,
            gtmId: null,
            ga4Id: null,
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
