import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { db } from "./db.js";
import {
  tags,
  videos,
  videoLikes,
  videoViews,
  systemSettings,
  tagImages,
} from "../shared/schema.js";
import { categorizeVideo } from "./ai-service.js";
import {
  insertVideoSchema,
  insertPlaylistSchema,
  insertSeoSettingsSchema,
} from "../shared/schema.js";
import { scheduler } from "./scheduler.js";
import { z } from "zod";
import { generateSlug, ensureUniqueSlug } from "./utils.js";
import { eq, and, sql as sqlOp, inArray } from "drizzle-orm";
import { kvService } from "./kv-service.js";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage/index.js";
import OpenAI from "openai";
import { requireAuth } from "./middleware/auth.js";
import { registerFeatureRoutes } from "./routes/index.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register object storage routes
  registerObjectStorageRoutes(app);
  
  // Register modular feature routes (auth, channels, tiktok)
  registerFeatureRoutes(app);

  // Video routes
  app.get("/api/videos", async (req, res) => {
    try {
      const { channelId, categoryId, search, limit, offset } = req.query;
      const filters = {
        channelId: channelId as string | undefined,
        categoryId: categoryId as string | undefined,
        search: search as string | undefined,
      };
      let videos = await storage.getAllVideos(filters);
      
      // Apply pagination if requested
      if (limit) {
        const limitNum = parseInt(limit as string, 10) || 20;
        const offsetNum = parseInt(offset as string, 10) || 0;
        videos = videos.slice(offsetNum, offsetNum + limitNum);
      }
      
      res.json(videos);
    } catch (error) {
      console.error("Get videos error:", error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });

  // Lightweight endpoint for hero video (homepage performance) - uses SQL LIMIT 1
  app.get("/api/videos/hero", async (req, res) => {
    try {
      const heroVideo = await storage.getHeroVideo();
      res.json(heroVideo);
    } catch (error) {
      console.error("Get hero video error:", error);
      res.status(500).json({ error: "Failed to fetch hero video" });
    }
  });

  // Lightweight endpoint for homepage carousels (pre-grouped, limited data) - uses SQL LIMIT
  app.get("/api/videos/carousels", async (req, res) => {
    try {
      const videosPerCategory = parseInt(req.query.limit as string, 10) || 10;
      
      // Fetch all data in parallel with database-level limits
      const [hero, recent, trending, allCategories] = await Promise.all([
        storage.getHeroVideo(),
        storage.getRecentVideos(videosPerCategory),
        storage.getTrendingVideos(videosPerCategory),
        storage.getAllCategories(),
      ]);

      // By category: fetch limited videos per category in parallel
      const categoryPromises = allCategories.map(async (category) => ({
        name: category.name,
        videos: await storage.getVideosByCategory(category.id, videosPerCategory),
      }));
      const categoryResults = await Promise.all(categoryPromises);
      
      const byCategory: Record<string, any[]> = {};
      for (const result of categoryResults) {
        if (result.videos.length > 0) {
          byCategory[result.name] = result.videos;
        }
      }

      res.json({ hero, recent, trending, byCategory });
    } catch (error) {
      console.error("Get carousels error:", error);
      res.status(500).json({ error: "Failed to fetch carousel data" });
    }
  });

  app.get("/api/videos/:idOrSlug", async (req, res) => {
    try {
      const { idOrSlug } = req.params;

      // Try to get video by slug first (most common case for SEO URLs)
      let video = await storage.getVideoWithRelationsBySlug(idOrSlug);

      // If not found by slug, try by ID (for backward compatibility)
      if (!video) {
        video = await storage.getVideoWithRelations(idOrSlug);
      }

      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      res.json(video);
    } catch (error) {
      console.error("Get video error:", error);
      res.status(500).json({ error: "Failed to fetch video" });
    }
  });

  app.patch("/api/videos/:id", requireAuth, async (req, res) => {
    try {
      const { title, description, categoryIds, tags } = req.body;
      const video = await storage.getVideo(req.params.id);

      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Update title and/or description if provided
      const updates: { title?: string; description?: string } = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;

      if (Object.keys(updates).length > 0) {
        await storage.updateVideo(req.params.id, updates);
      }

      // Update categories if provided
      if (categoryIds !== undefined) {
        await storage.removeVideoCategories(req.params.id);
        for (const categoryId of categoryIds) {
          await storage.addVideoCategory(req.params.id, categoryId);
        }
      }

      // Update tags if provided
      if (tags !== undefined) {
        await storage.deleteTagsByVideoId(req.params.id);
        for (const tagName of tags) {
          await storage.createTag({ videoId: req.params.id, tagName });
        }
      }

      const updatedVideo = await storage.getVideoWithRelations(req.params.id);
      res.json(updatedVideo);
    } catch (error) {
      console.error("Update video error:", error);
      res.status(500).json({ error: "Failed to update video" });
    }
  });

  app.delete("/api/videos/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete video error:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  app.post("/api/videos/:id/categorize", requireAuth, async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Use AI to categorize and tag
      const result = await categorizeVideo(
        video.title,
        video.description || "",
      );

      // Remove existing categories and tags
      await storage.removeVideoCategories(video.id);
      await storage.deleteTagsByVideoId(video.id);

      // Create/find categories and link them
      for (const categoryName of result.categories) {
        const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        let category = await storage.getCategoryBySlug(slug);

        if (!category) {
          category = await storage.createCategory({
            name: categoryName,
            slug,
          });
        }

        await storage.addVideoCategory(video.id, category.id);

        // Update category video count
        const categoryVideos = await storage.getAllVideos({
          categoryId: category.id,
        });
        await storage.updateCategory(category.id, {
          videoCount: categoryVideos.length,
        });
      }

      // Create tags
      for (const tagName of result.tags) {
        await storage.createTag({
          videoId: video.id,
          tagName,
        });
      }

      res.json({ success: true, result });
    } catch (error) {
      console.error("Categorize video error:", error);
      res.status(500).json({ error: "Failed to categorize video" });
    }
  });

  // Bulk video operations
  app.post("/api/videos/bulk/categorize", requireAuth, async (req, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ error: "videoIds array is required" });
      }

      const results = {
        total: videoIds.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const videoId of videoIds) {
        try {
          const video = await storage.getVideo(videoId);
          if (!video) {
            results.failed++;
            results.errors.push(`Video ${videoId} not found`);
            continue;
          }

          const result = await categorizeVideo(
            video.title,
            video.description || "",
          );
          await storage.removeVideoCategories(video.id);
          await storage.deleteTagsByVideoId(video.id);

          for (const categoryName of result.categories) {
            const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            let category = await storage.getCategoryBySlug(slug);

            if (!category) {
              category = await storage.createCategory({
                name: categoryName,
                slug,
              });
            }

            await storage.addVideoCategory(video.id, category.id);
          }

          for (const tagName of result.tags) {
            await storage.createTag({ videoId: video.id, tagName });
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to categorize video ${videoId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          console.error(`Bulk categorize error for video ${videoId}:`, error);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Bulk categorize error:", error);
      res.status(500).json({ error: "Failed to bulk categorize videos" });
    }
  });

  app.post("/api/videos/bulk/tag", requireAuth, async (req, res) => {
    try {
      const { videoIds, tags } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ error: "videoIds array is required" });
      }
      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: "tags array is required" });
      }

      const results = {
        total: videoIds.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const videoId of videoIds) {
        try {
          const video = await storage.getVideo(videoId);
          if (!video) {
            results.failed++;
            results.errors.push(`Video ${videoId} not found`);
            continue;
          }

          for (const tagName of tags) {
            await storage.createTag({ videoId: video.id, tagName });
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to tag video ${videoId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          console.error(`Bulk tag error for video ${videoId}:`, error);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Bulk tag error:", error);
      res.status(500).json({ error: "Failed to bulk tag videos" });
    }
  });

  app.delete("/api/videos/bulk", requireAuth, async (req, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ error: "videoIds array is required" });
      }

      const results = {
        total: videoIds.length,
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const videoId of videoIds) {
        try {
          await storage.deleteVideo(videoId);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to delete video ${videoId}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          console.error(`Bulk delete error for video ${videoId}:`, error);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ error: "Failed to bulk delete videos" });
    }
  });

  // Like and view tracking routes
  function getUserIdentifier(req: Request): string {
    // Use session ID if available, otherwise fall back to IP address
    return req.sessionID || req.ip || "anonymous";
  }

  app.post("/api/videos/:id/like", async (req, res) => {
    try {
      const videoId = req.params.id;
      const userIdentifier = getUserIdentifier(req);

      // Check rate limit
      const allowed = await kvService.checkRateLimit(userIdentifier, 'like');
      if (!allowed) {
        return res.status(429).json({ 
          error: "Too many like requests. Please slow down.",
          retryAfter: 60
        });
      }

      // Check if already liked
      const existingLike = await db
        .select()
        .from(videoLikes)
        .where(
          and(
            eq(videoLikes.videoId, videoId),
            eq(videoLikes.userIdentifier, userIdentifier),
          ),
        )
        .limit(1);

      if (existingLike.length > 0) {
        return res.status(400).json({ error: "Already liked" });
      }

      // Add like
      await db.insert(videoLikes).values({
        videoId,
        userIdentifier,
      });

      // Increment likes count
      await db
        .update(videos)
        .set({ likesCount: sqlOp`${videos.likesCount} + 1` })
        .where(eq(videos.id, videoId));

      // Get updated video
      const [updatedVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      res.json({ success: true, likesCount: updatedVideo?.likesCount || 0 });
    } catch (error) {
      console.error("Like video error:", error);
      res.status(500).json({ error: "Failed to like video" });
    }
  });

  app.delete("/api/videos/:id/like", async (req, res) => {
    try {
      const videoId = req.params.id;
      const userIdentifier = getUserIdentifier(req);

      // Check if liked
      const existingLike = await db
        .select()
        .from(videoLikes)
        .where(
          and(
            eq(videoLikes.videoId, videoId),
            eq(videoLikes.userIdentifier, userIdentifier),
          ),
        )
        .limit(1);

      if (existingLike.length === 0) {
        return res.status(400).json({ error: "Not liked" });
      }

      // Remove like
      await db
        .delete(videoLikes)
        .where(
          and(
            eq(videoLikes.videoId, videoId),
            eq(videoLikes.userIdentifier, userIdentifier),
          ),
        );

      // Decrement likes count
      await db
        .update(videos)
        .set({ likesCount: sqlOp`GREATEST(${videos.likesCount} - 1, 0)` })
        .where(eq(videos.id, videoId));

      // Get updated video
      const [updatedVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      res.json({ success: true, likesCount: updatedVideo?.likesCount || 0 });
    } catch (error) {
      console.error("Unlike video error:", error);
      res.status(500).json({ error: "Failed to unlike video" });
    }
  });

  app.get("/api/videos/:id/like-status", async (req, res) => {
    try {
      const videoId = req.params.id;
      const userIdentifier = getUserIdentifier(req);

      const existingLike = await db
        .select()
        .from(videoLikes)
        .where(
          and(
            eq(videoLikes.videoId, videoId),
            eq(videoLikes.userIdentifier, userIdentifier),
          ),
        )
        .limit(1);

      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      res.json({
        isLiked: existingLike.length > 0,
        likesCount: video?.likesCount || 0,
      });
    } catch (error) {
      console.error("Get like status error:", error);
      res.status(500).json({ error: "Failed to get like status" });
    }
  });

  app.post("/api/videos/:id/view", async (req, res) => {
    try {
      const videoId = req.params.id;
      const userIdentifier = getUserIdentifier(req);

      // Use buffered view tracking (reduces DB writes)
      await kvService.bufferView(videoId, userIdentifier);

      // Also record in videoViews table for detailed analytics
      await db.insert(videoViews).values({
        videoId,
        userIdentifier,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Track view error:", error);
      res.status(500).json({ error: "Failed to track view" });
    }
  });

  // Batch like-status endpoint to avoid N+1 queries
  app.post("/api/videos/batch/like-status", async (req, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ error: "videoIds array is required" });
      }

      const userIdentifier = getUserIdentifier(req);

      // Get all likes for these videos for this user
      const userLikes = await db
        .select()
        .from(videoLikes)
        .where(
          and(
            inArray(videoLikes.videoId, videoIds),
            eq(videoLikes.userIdentifier, userIdentifier),
          ),
        );

      // Get like counts for all videos
      const videosData = await db
        .select({
          id: videos.id,
          likesCount: videos.likesCount,
        })
        .from(videos)
        .where(inArray(videos.id, videoIds));

      // Build response object
      const result: Record<string, { isLiked: boolean; likesCount: number }> =
        {};

      for (const video of videosData) {
        result[video.id] = {
          isLiked: userLikes.some((like) => like.videoId === video.id),
          likesCount: video.likesCount || 0,
        };
      }

      res.json(result);
    } catch (error) {
      console.error("Batch get like status error:", error);
      res.status(500).json({ error: "Failed to get batch like status" });
    }
  });

  // Shorts routes (YouTube Shorts and TikTok)
  app.get("/api/shorts", async (req, res) => {
    try {
      const { type, limit, offset } = req.query;
      const filters: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number } = {};
      
      if (type === "youtube_short" || type === "tiktok") {
        filters.type = type;
      }
      if (limit) {
        const parsedLimit = parseInt(limit as string, 10);
        filters.limit = Math.min(Math.max(isNaN(parsedLimit) ? 50 : parsedLimit, 1), 100);
      }
      if (offset) {
        const parsedOffset = parseInt(offset as string, 10);
        filters.offset = Math.max(isNaN(parsedOffset) ? 0 : parsedOffset, 0);
      }
      
      const shorts = await storage.getShorts(filters);
      res.json(shorts);
    } catch (error) {
      console.error("Get shorts error:", error);
      res.status(500).json({ error: "Failed to fetch shorts" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const { name, description } = req.body;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const existingCategory = await storage.getCategoryBySlug(slug);
      if (existingCategory) {
        return res
          .status(400)
          .json({ error: "Category with this name already exists" });
      }

      const category = await storage.createCategory({
        name,
        slug,
        description,
      });
      res.json(category);
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updateData: Partial<{
        name?: string;
        slug?: string;
        description?: string;
      }> = {};
      if (name) {
        updateData.name = name;
        updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      }
      if (description !== undefined) {
        updateData.description = description;
      }

      const category = await storage.updateCategory(id, updateData);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Analytics routes
  app.get("/api/analytics", async (req, res) => {
    try {
      const { days } = req.query;
      const daysFilter = days ? parseInt(days as string) : undefined;

      // Get total counts
      const channels = await storage.getAllChannels();
      const allVideos = await storage.getAllVideos();
      const categories = await storage.getAllCategories();
      const allTags = await db.select().from(tags);

      // Filter by date if specified
      let filteredVideos = allVideos;
      if (daysFilter) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysFilter);
        filteredVideos = allVideos.filter((v) => {
          if (!v.publishDate) return false;
          const publishDate = new Date(v.publishDate);
          return publishDate >= cutoffDate;
        });
      }

      // Get filtered video IDs for tag filtering
      const filteredVideoIds = new Set(filteredVideos.map((v) => v.id));

      // Top categories by video count
      const categoryVideoCount = new Map<
        string,
        { name: string; count: number }
      >();
      for (const video of filteredVideos) {
        if (video.categories && video.categories.length > 0) {
          for (const cat of video.categories) {
            const existing = categoryVideoCount.get(cat.id);
            if (existing) {
              existing.count++;
            } else {
              categoryVideoCount.set(cat.id, { name: cat.name, count: 1 });
            }
          }
        }
      }
      const topCategories = Array.from(categoryVideoCount.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Channel performance (videos per channel)
      const channelPerformance = channels.map((channel) => ({
        name: channel.name,
        videoCount: filteredVideos.filter((v) => v.channelId === channel.id)
          .length,
      }));

      // Tag frequency (only from filtered videos)
      const tagFrequency = new Map<string, number>();
      for (const tag of allTags) {
        if (filteredVideoIds.has(tag.videoId)) {
          const count = tagFrequency.get(tag.tagName) || 0;
          tagFrequency.set(tag.tagName, count + 1);
        }
      }
      const topTags = Array.from(tagFrequency.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Category distribution
      const categoryDistribution = Array.from(categoryVideoCount.values()).sort(
        (a, b) => b.count - a.count,
      );

      // Calculate filtered totals
      const uniqueChannelIds = new Set(filteredVideos.map((v) => v.channelId));
      const uniqueCategoryIds = new Set<string>();
      for (const video of filteredVideos) {
        if (video.categories) {
          for (const cat of video.categories) {
            uniqueCategoryIds.add(cat.id);
          }
        }
      }
      const filteredTagCount = Array.from(tagFrequency.values()).reduce(
        (sum, count) => sum + count,
        0,
      );

      res.json({
        totals: {
          channels: uniqueChannelIds.size,
          videos: filteredVideos.length,
          categories: uniqueCategoryIds.size,
          tags: filteredTagCount,
          allTimeVideos: allVideos.length,
        },
        topCategories,
        channelPerformance: channelPerformance.sort(
          (a, b) => b.videoCount - a.videoCount,
        ),
        categoryDistribution,
        topTags,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // Playlist routes
  app.post("/api/playlists", requireAuth, async (req, res) => {
    try {
      const data = insertPlaylistSchema.parse(req.body);
      const playlist = await storage.createPlaylist(data);
      res.json(playlist);
    } catch (error) {
      console.error("Create playlist error:", error);
      res.status(400).json({ error: "Failed to create playlist" });
    }
  });

  app.get("/api/playlists", async (req, res) => {
    try {
      const playlists = await storage.getAllPlaylists();
      res.json(playlists);
    } catch (error) {
      console.error("Get playlists error:", error);
      res.status(500).json({ error: "Failed to fetch playlists" });
    }
  });

  app.get("/api/playlists/:id", async (req, res) => {
    try {
      const playlist = await storage.getPlaylistWithVideos(req.params.id);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }
      res.json(playlist);
    } catch (error) {
      console.error("Get playlist error:", error);
      res.status(500).json({ error: "Failed to fetch playlist" });
    }
  });

  app.patch("/api/playlists/:id", requireAuth, async (req, res) => {
    try {
      const playlist = await storage.updatePlaylist(req.params.id, req.body);
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }
      res.json(playlist);
    } catch (error) {
      console.error("Update playlist error:", error);
      res.status(500).json({ error: "Failed to update playlist" });
    }
  });

  app.delete("/api/playlists/:id", requireAuth, async (req, res) => {
    try {
      await storage.deletePlaylist(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete playlist error:", error);
      res.status(500).json({ error: "Failed to delete playlist" });
    }
  });

  app.post("/api/playlists/:id/videos", requireAuth, async (req, res) => {
    try {
      const { videoId } = req.body;
      if (!videoId) {
        return res.status(400).json({ error: "videoId is required" });
      }
      await storage.addVideoToPlaylist(req.params.id, videoId);
      res.json({ success: true });
    } catch (error) {
      console.error("Add video to playlist error:", error);
      res.status(500).json({ error: "Failed to add video to playlist" });
    }
  });

  app.delete(
    "/api/playlists/:id/videos/:videoId",
    requireAuth,
    async (req, res) => {
      try {
        await storage.removeVideoFromPlaylist(
          req.params.id,
          req.params.videoId,
        );
        res.json({ success: true });
      } catch (error) {
        console.error("Remove video from playlist error:", error);
        res.status(500).json({ error: "Failed to remove video from playlist" });
      }
    },
  );

  // Scheduler routes
  app.get("/api/scheduler", async (req, res) => {
    try {
      const settings = await scheduler.getSettings();
      const status = scheduler.getStatus();
      res.json({ ...settings, ...status });
    } catch (error) {
      console.error("Get scheduler error:", error);
      res.status(500).json({ error: "Failed to fetch scheduler status" });
    }
  });

  app.post("/api/scheduler/start", requireAuth, async (req, res) => {
    try {
      await scheduler.start();
      const settings = await scheduler.getSettings();
      res.json({ success: true, settings });
    } catch (error) {
      console.error("Start scheduler error:", error);
      res.status(500).json({ error: "Failed to start scheduler" });
    }
  });

  app.post("/api/scheduler/stop", requireAuth, async (req, res) => {
    try {
      await scheduler.stop();
      const settings = await scheduler.getSettings();
      res.json({ success: true, settings });
    } catch (error) {
      console.error("Stop scheduler error:", error);
      res.status(500).json({ error: "Failed to stop scheduler" });
    }
  });

  app.patch("/api/scheduler", requireAuth, async (req, res) => {
    try {
      const { intervalHours } = req.body;
      const settings = await scheduler.updateSettings({ intervalHours });

      // Restart if currently enabled
      if (settings.isEnabled) {
        await scheduler.stop();
        await scheduler.start();
      }

      res.json(settings);
    } catch (error) {
      console.error("Update scheduler error:", error);
      res.status(500).json({ error: "Failed to update scheduler" });
    }
  });

  app.post("/api/scheduler/run-now", requireAuth, async (req, res) => {
    try {
      // Run scrape job immediately (don't await to return response quickly)
      scheduler.runScrapeJob().catch((error) => {
        console.error("Manual scrape job error:", error);
      });
      res.json({ success: true, message: "Scrape job started" });
    } catch (error) {
      console.error("Run scheduler error:", error);
      res.status(500).json({ error: "Failed to run scheduler" });
    }
  });

  // Tags management routes
  app.get("/api/tags/stats", async (req, res) => {
    try {
      const allTags = await db.select().from(tags);
      const tagCounts = allTags.reduce(
        (acc, tag) => {
          if (!acc[tag.tagName]) {
            acc[tag.tagName] = { tagName: tag.tagName, count: 0, videoIds: [] };
          }
          acc[tag.tagName].count++;
          acc[tag.tagName].videoIds.push(tag.videoId);
          return acc;
        },
        {} as Record<
          string,
          { tagName: string; count: number; videoIds: string[] }
        >,
      );

      res.json(Object.values(tagCounts));
    } catch (error) {
      console.error("Error fetching tag stats:", error);
      res.status(500).json({ error: "Failed to fetch tag statistics" });
    }
  });

  app.delete("/api/tags/:tagName", requireAuth, async (req, res) => {
    try {
      const { tagName } = req.params;
      await db.delete(tags).where(eq(tags.tagName, tagName));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // Tag Images routes
  app.get("/api/tag-images", async (req, res) => {
    try {
      const images = await db.select().from(tagImages);
      res.json(images);
    } catch (error) {
      console.error("Error fetching tag images:", error);
      res.status(500).json({ error: "Failed to fetch tag images" });
    }
  });

  app.post("/api/admin/tags/:tagName/generate-image", requireAuth, async (req, res) => {
    try {
      const { tagName } = req.params;
      const decodedTagName = decodeURIComponent(tagName);
      
      const openai = new OpenAI();
      
      const prompt = `Abstract artistic background representing "${decodedTagName}", modern digital art style, vibrant colors, suitable for a video streaming platform hero section, 16:9 aspect ratio, no text`;
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
      });
      
      const generatedImageUrl = response.data?.[0]?.url;
      if (!generatedImageUrl) {
        throw new Error("No image URL returned from OpenAI");
      }
      
      const existingImage = await db.select().from(tagImages).where(eq(tagImages.tagName, decodedTagName)).limit(1);
      
      let result;
      if (existingImage.length > 0) {
        [result] = await db
          .update(tagImages)
          .set({ imageUrl: generatedImageUrl, isAiGenerated: 1 })
          .where(eq(tagImages.tagName, decodedTagName))
          .returning();
      } else {
        [result] = await db
          .insert(tagImages)
          .values({ tagName: decodedTagName, imageUrl: generatedImageUrl, isAiGenerated: 1 })
          .returning();
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error generating tag image:", error);
      res.status(500).json({ error: "Failed to generate tag image" });
    }
  });

  app.post("/api/admin/tags/:tagName/image", requireAuth, async (req, res) => {
    try {
      const { tagName } = req.params;
      const { imageUrl } = req.body;
      const decodedTagName = decodeURIComponent(tagName);
      
      if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(imageUrl);
      
      const existingImage = await db.select().from(tagImages).where(eq(tagImages.tagName, decodedTagName)).limit(1);
      
      let result;
      if (existingImage.length > 0) {
        [result] = await db
          .update(tagImages)
          .set({ imageUrl: normalizedPath, isAiGenerated: 0 })
          .where(eq(tagImages.tagName, decodedTagName))
          .returning();
      } else {
        [result] = await db
          .insert(tagImages)
          .values({ tagName: decodedTagName, imageUrl: normalizedPath, isAiGenerated: 0 })
          .returning();
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error saving tag image:", error);
      res.status(500).json({ error: "Failed to save tag image" });
    }
  });

  app.delete("/api/admin/tags/:tagName/image", requireAuth, async (req, res) => {
    try {
      const { tagName } = req.params;
      const decodedTagName = decodeURIComponent(tagName);
      
      await db.delete(tagImages).where(eq(tagImages.tagName, decodedTagName));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tag image:", error);
      res.status(500).json({ error: "Failed to delete tag image" });
    }
  });

  // System settings routes
  app.get("/api/system/settings", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      if (settings) return res.json(settings);

      const created = await storage.updateSystemSettings({});
      return res.json(created);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      // Return default settings on error to prevent app breakage
      res.json({
        id: "default",
        customHeadCode: "",
        customBodyStartCode: "",
        customBodyEndCode: "",
        siteTitle: "nisam.video",
        siteDescription: "AI-Powered Video Hub",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });

  app.patch("/api/system/settings", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateSystemSettings(req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating system settings:", error);
      res.status(500).json({ error: "Failed to update system settings" });
    }
  });

  // Client Logging Route
  app.post("/api/client-logs", async (req, res) => {
    try {
      // Check if logging is enabled
      const { systemSettings: settingsTable, activityLogs: logsTable } = await import("@shared/schema");
      const [settings] = await db.select().from(settingsTable).limit(1);
      
      if (!settings || settings.clientErrorLogging !== 1) {
        return res.json({ success: false, message: "Logging disabled" });
      }

      const { error, info, url } = req.body;
      const userIdentifier = getUserIdentifier(req);

      await db.insert(logsTable).values({
        action: "client_error",
        entityType: "error",
        username: userIdentifier,
        details: JSON.stringify({ error, info, url, userAgent: req.headers["user-agent"] }),
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Client logging error:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("activity_logs") &&
        (message.includes("does not exist") || message.includes("relation"))
      ) {
        return res.json({ success: false, message: "Logging unavailable" });
      }
      res.status(500).json({ error: "Failed to log client error" });
    }
  });

  // Activity logs routes
  app.get("/api/activity-logs", requireAuth, async (req, res) => {
    try {
      const { activityLogs: logsTable } = await import("@shared/schema");
      const logs = await db
        .select()
        .from(logsTable)
        .orderBy(sqlOp`${logsTable.createdAt} DESC`)
        .limit(500);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("activity_logs") &&
        (message.includes("does not exist") || message.includes("relation"))
      ) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Admin dashboard stats route
  app.get("/api/admin/dashboard", requireAuth, async (req, res) => {
    try {
      // This endpoint returns simplified stats for the dashboard
      // More detailed stats are available through existing endpoints
      res.json({
        message: "Use existing endpoints for stats",
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Regeneration route
  app.post("/api/admin/regenerate", requireAuth, async (req, res) => {
    try {
      const type = (req.query.type as string) || "all";
      const videos = await storage.getAllVideos();

      let processed = 0;
      let categoriesGenerated = 0;
      let tagsGenerated = 0;

      // Process videos in batches to avoid overwhelming the AI
      for (const video of videos) {
        try {
          if (type === "all" || type === "categories" || type === "tags") {
            // Remove existing categories and tags
            if (type === "all" || type === "categories") {
              await storage.removeVideoCategories(video.id);
            }
            if (type === "all" || type === "tags") {
              await storage.deleteTagsByVideoId(video.id);
            }

            // Regenerate with AI
            const categorizeResult = await categorizeVideo(
              video.title,
              video.description || "",
            );

            // Add new categories
            if (
              (type === "all" || type === "categories") &&
              categorizeResult.categories
            ) {
              for (const categorySlug of categorizeResult.categories) {
                const category = await storage.getCategoryBySlug(categorySlug);
                if (category) {
                  await storage.addVideoCategory(video.id, category.id);
                  categoriesGenerated++;
                }
              }
            }

            // Add new tags
            if ((type === "all" || type === "tags") && categorizeResult.tags) {
              for (const tagName of categorizeResult.tags) {
                await storage.createTag({ videoId: video.id, tagName });
                tagsGenerated++;
              }
            }

            processed++;
          }
        } catch (error) {
          console.error(`Error regenerating video ${video.id}:`, error);
          // Continue with next video
        }
      }

      // Clear cache after regeneration
      const { cache: cacheModule } = await import("./cache");
      cacheModule.clear();

      res.json({
        success: true,
        processed,
        categoriesGenerated,
        tagsGenerated,
      });
    } catch (error) {
      console.error("Regeneration error:", error);
      res.status(500).json({ error: "Failed to regenerate content" });
    }
  });

  // Regenerate slugs for all videos
  app.post("/api/admin/regenerate-slugs", requireAuth, async (req, res) => {
    try {
      const videos = await storage.getAllVideos();
      let processed = 0;
      const existingSlugs: string[] = [];

      // Get all existing slugs to ensure uniqueness
      for (const video of videos) {
        if (video.slug) {
          existingSlugs.push(video.slug);
        }
      }

      // Regenerate slugs for all videos
      for (const video of videos) {
        try {
          // Generate new slug from title
          const baseSlug = generateSlug(video.title);

          // Ensure uniqueness
          const newSlug = ensureUniqueSlug(baseSlug, existingSlugs);

          // Update if slug changed
          if (newSlug !== video.slug) {
            await storage.updateVideo(video.id, { slug: newSlug });
            existingSlugs.push(newSlug);
            processed++;
          }
        } catch (error) {
          console.error(
            `Error regenerating slug for video ${video.id}:`,
            error,
          );
          // Continue with next video
        }
      }

      // Clear cache after regeneration
      const { cache: cacheModule } = await import("./cache");
      cacheModule.clear();

      res.json({
        success: true,
        processed,
        message: `Successfully regenerated ${processed} video URLs`,
      });
    } catch (error) {
      console.error("Slug regeneration error:", error);
      res.status(500).json({ error: "Failed to regenerate slugs" });
    }
  });

  // Cache management routes
  app.get("/api/admin/cache/stats", requireAuth, async (req, res) => {
    try {
      const { cache: cacheModule } = await import("./cache.js");
      const stats = cacheModule.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Get cache stats error:", error);
      res.status(500).json({ error: "Failed to get cache statistics" });
    }
  });

  app.post("/api/admin/cache/clear", requireAuth, async (req, res) => {
    try {
      const { cache: cacheModule } = await import("./cache");
      cacheModule.clear();
      res.json({ success: true, message: "Cache cleared successfully" });
    } catch (error) {
      console.error("Clear cache error:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  app.get("/api/admin/cache/settings", requireAuth, async (req, res) => {
    try {
      const [settings] = await db.select().from(systemSettings).limit(1);
      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      res.json({
        cacheEnabled: settings.cacheEnabled === 1,
        cacheVideosTTL: settings.cacheVideosTTL,
        cacheChannelsTTL: settings.cacheChannelsTTL,
        cacheCategoriesTTL: settings.cacheCategoriesTTL,
        cacheApiTTL: settings.cacheApiTTL,
      });
    } catch (error) {
      console.error("Get cache settings error:", error);
      res.status(500).json({ error: "Failed to get cache settings" });
    }
  });

  app.put("/api/admin/cache/settings", requireAuth, async (req, res) => {
    try {
      const {
        cacheEnabled,
        cacheVideosTTL,
        cacheChannelsTTL,
        cacheCategoriesTTL,
        cacheApiTTL,
      } = req.body;

      const [existingSettings] = await db
        .select()
        .from(systemSettings)
        .limit(1);
      const updateData: any = { updatedAt: new Date() };

      if (cacheEnabled !== undefined) {
        updateData.cacheEnabled = cacheEnabled ? 1 : 0;
        const { cache: cacheModule } = await import("./cache.js");
        cacheModule.setEnabled(cacheEnabled);
      }
      if (cacheVideosTTL !== undefined)
        updateData.cacheVideosTTL = cacheVideosTTL;
      if (cacheChannelsTTL !== undefined)
        updateData.cacheChannelsTTL = cacheChannelsTTL;
      if (cacheCategoriesTTL !== undefined)
        updateData.cacheCategoriesTTL = cacheCategoriesTTL;
      if (cacheApiTTL !== undefined) updateData.cacheApiTTL = cacheApiTTL;

      if (!existingSettings) {
        await db.insert(systemSettings).values(updateData);
      } else {
        await db
          .update(systemSettings)
          .set(updateData)
          .where(eq(systemSettings.id, existingSettings.id));
      }

      res.json({
        success: true,
        message: "Cache settings updated successfully",
      });
    } catch (error) {
      console.error("Update cache settings error:", error);
      res.status(500).json({ error: "Failed to update cache settings" });
    }
  });

  // KV Store management routes
  app.get("/api/admin/kv/stats", requireAuth, async (req, res) => {
    try {
      const stats = await kvService.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Get KV stats error:", error);
      res.status(500).json({ error: "Failed to get KV store statistics" });
    }
  });

  app.post("/api/admin/kv/flush-buffers", requireAuth, async (req, res) => {
    try {
      const flushed = await kvService.flushAllViewBuffers();
      res.json({ 
        success: true, 
        message: `Flushed ${flushed} view buffer${flushed !== 1 ? 's' : ''}`,
        flushed 
      });
    } catch (error) {
      console.error("Flush buffers error:", error);
      res.status(500).json({ error: "Failed to flush view buffers" });
    }
  });

  app.post("/api/admin/kv/cleanup", requireAuth, async (req, res) => {
    try {
      const cleaned = await kvService.cleanupRateLimits();
      res.json({ 
        success: true, 
        message: `Cleaned ${cleaned} expired rate limit${cleaned !== 1 ? 's' : ''}`,
        cleaned 
      });
    } catch (error) {
      console.error("Cleanup error:", error);
      res.status(500).json({ error: "Failed to cleanup KV store" });
    }
  });

  // Viewing history route (public)
  app.get("/api/user/viewing-history", async (req, res) => {
    try {
      const userIdentifier = getUserIdentifier(req);
      const videoIds = await kvService.getViewingHistory(userIdentifier);
      
      // Fetch video details for the history
      if (videoIds.length === 0) {
        return res.json([]);
      }
      
      const videoDetails = await storage.getAllVideos();
      const historyVideos = videoIds
        .map(id => videoDetails.find(v => v.id === id))
        .filter(Boolean);
      
      res.json(historyVideos);
    } catch (error) {
      console.error("Get viewing history error:", error);
      res.status(500).json({ error: "Failed to get viewing history" });
    }
  });

  // Data Export routes
  app.get("/api/export/:type", requireAuth, async (req, res) => {
    try {
      const { type } = req.params;
      const format = (req.query.format as string) || "json";

      let data: any[] = [];
      let filename = "";

      switch (type) {
        case "videos":
          data = await storage.getAllVideos();
          filename = `videos-export-${new Date().toISOString().split("T")[0]}`;
          break;
        case "channels":
          data = await storage.getAllChannels();
          filename = `channels-export-${new Date().toISOString().split("T")[0]}`;
          break;
        case "categories":
          data = await storage.getAllCategories();
          filename = `categories-export-${new Date().toISOString().split("T")[0]}`;
          break;
        case "tags":
          const allTags = await db.select().from(tags);
          data = allTags;
          filename = `tags-export-${new Date().toISOString().split("T")[0]}`;
          break;
        case "analytics":
          const videos = await storage.getAllVideos();
          data = videos.map((v) => ({
            id: v.id,
            title: v.title,
            channelName: v.channel?.name || "",
            internalViews: v.internalViewsCount,
            likes: v.likesCount,
            publishDate: v.publishDate,
          }));
          filename = `analytics-export-${new Date().toISOString().split("T")[0]}`;
          break;
        default:
          res.status(400).json({ error: "Invalid export type" });
          return;
      }

      if (format === "csv") {
        // Convert to CSV
        if (data.length === 0) {
          res.status(200).send("No data available");
          return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
          headers.join(","),
          ...data.map((row) =>
            headers
              .map((header) => {
                const value = row[header];
                if (value === null || value === undefined) return "";
                const stringValue = String(value);
                // Escape quotes and wrap in quotes if contains comma or quote
                if (
                  stringValue.includes(",") ||
                  stringValue.includes('"') ||
                  stringValue.includes("\n")
                ) {
                  return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
              })
              .join(","),
          ),
        ];

        res.header("Content-Type", "text/csv");
        res.header(
          "Content-Disposition",
          `attachment; filename="${filename}.csv"`,
        );
        res.send(csvRows.join("\n"));
      } else {
        // Return JSON
        res.header("Content-Type", "application/json");
        res.header(
          "Content-Disposition",
          `attachment; filename="${filename}.json"`,
        );
        res.json(data);
      }
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // SEO Settings routes
  app.get("/api/seo/settings", async (req, res) => {
    try {
      const settings = await storage.getSeoSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get SEO settings error:", error);
      res.status(500).json({ error: "Failed to get SEO settings" });
    }
  });

  app.patch("/api/seo/settings", requireAuth, async (req, res) => {
    try {
      // Validate request body
      const validatedData = insertSeoSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSeoSettings(validatedData);
      res.json(settings);
    } catch (error) {
      console.error("Update SEO settings error:", error);
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: "Invalid SEO settings data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update SEO settings" });
      }
    }
  });

  // Utility routes
  app.post("/api/utils/update-thumbnails", requireAuth, async (req, res) => {
    try {
      const count = await storage.updateAllVideoThumbnails();
      res.json({
        success: true,
        updated: count,
        message: `Updated ${count} video thumbnails to high quality`,
      });
    } catch (error) {
      console.error("Update thumbnails error:", error);
      res.status(500).json({ error: "Failed to update thumbnails" });
    }
  });

  // SEO Routes - Sitemap and Robots
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const videos = await storage.getAllVideos();
      const categories = await storage.getAllCategories();
      const baseUrl = "https://nisam.video";

      // Build sitemap XML
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
      sitemap +=
        'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';

      // Homepage
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/</loc>\n`;
      sitemap += "    <changefreq>daily</changefreq>\n";
      sitemap += "    <priority>1.0</priority>\n";
      sitemap += "  </url>\n";

      // Categories page
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/categories</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.8</priority>\n";
      sitemap += "  </url>\n";

      // Tags page
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/tags</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.8</priority>\n";
      sitemap += "  </url>\n";

      // Popular page
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/popular</loc>\n`;
      sitemap += "    <changefreq>daily</changefreq>\n";
      sitemap += "    <priority>0.9</priority>\n";
      sitemap += "  </url>\n";

      // Category filter pages
      for (const category of categories) {
        sitemap += "  <url>\n";
        sitemap += `    <loc>${baseUrl}/categories?filter=${category.id}</loc>\n`;
        sitemap += "    <changefreq>weekly</changefreq>\n";
        sitemap += "    <priority>0.7</priority>\n";
        sitemap += "  </url>\n";
      }

      // Individual video pages with video metadata
      for (const video of videos) {
        try {
          sitemap += "  <url>\n";
          sitemap += `    <loc>${baseUrl}/video/${video.slug || video.id}</loc>\n`;
          sitemap += "    <changefreq>monthly</changefreq>\n";
          sitemap += "    <priority>0.6</priority>\n";
          sitemap += "    <video:video>\n";
          sitemap += `      <video:thumbnail_loc>${video.thumbnailUrl}</video:thumbnail_loc>\n`;
          sitemap += `      <video:title>${video.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</video:title>\n`;
          if (video.description) {
            const cleanDesc = video.description
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            sitemap += `      <video:description>${cleanDesc.substring(0, 2048)}</video:description>\n`;
          }
          sitemap += `      <video:content_loc>https://www.youtube.com/watch?v=${video.videoId}</video:content_loc>\n`;
          sitemap += `      <video:player_loc>https://www.youtube.com/embed/${video.videoId}</video:player_loc>\n`;
          // Use createdAt for publication_date in ISO 8601 format
          if (video.createdAt) {
            try {
              const pubDate = new Date(video.createdAt).toISOString();
              sitemap += `      <video:publication_date>${pubDate}</video:publication_date>\n`;
            } catch (dateError) {
              console.error(
                `Error formatting date for video ${video.id}:`,
                dateError,
              );
            }
          }
          sitemap += "    </video:video>\n";
          sitemap += "  </url>\n";
        } catch (videoError) {
          console.error(
            `Error processing video ${video.id} in sitemap:`,
            videoError,
          );
          // Continue with next video
        }
      }

      sitemap += "</urlset>";

      res.header("Content-Type", "application/xml");
      res.send(sitemap);
    } catch (error) {
      console.error("Sitemap generation error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", async (req, res) => {
    // Use the custom domain if available, otherwise fall back to host header
    const baseUrl = "https://nisam.video";

    const robotsTxt = `# Robots.txt for nisam.video
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay (be nice to servers)
Crawl-delay: 1
`;

    res.header("Content-Type", "text/plain");
    res.send(robotsTxt);
  });

  const httpServer = createServer(app);

  return httpServer;
}
