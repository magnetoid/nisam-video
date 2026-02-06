import { Router, Request } from "express";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { videos, videoLikes, videoViews, tags } from "../../shared/schema.js";
import { categorizeVideo } from "../ai-service.js";
import { requireAuth } from "../middleware/auth.js";
import { kvService } from "../kv-service.js";
import { eq, and, sql as sqlOp, inArray } from "drizzle-orm";
import { getUserIdentifier } from "../utils.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { channelId, categoryId, search, limit, offset, lang, tagName } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) || 20 : undefined;
    const offsetNum = offset ? parseInt(offset as string, 10) || 0 : undefined;
    const filters = {
      channelId: channelId as string | undefined,
      categoryId: categoryId as string | undefined,
      search: search as string | undefined,
      tagName: tagName as string | undefined,
      lang: lang as string | undefined,
      limit: limitNum,
      offset: limitNum ? offsetNum : undefined,
    };
    const videosList = await storage.getAllVideos(filters);
    res.json(videosList);
  } catch (error) {
    console.error(`Get videos error [params=${JSON.stringify(req.query)}]:`, error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

router.get("/hero", async (req, res) => {
  try {
    const heroVideo = await storage.getHeroVideo();
    res.json(heroVideo);
  } catch (error) {
    console.error("Get hero video error:", error);
    res.status(500).json({ error: "Failed to fetch hero video" });
  }
});

router.get("/carousels", async (req, res) => {
  try {
    const lang = req.query.lang as string || 'en';
    const videosPerCategory = parseInt(req.query.limit as string, 10) || 10;
    
    // Wrap each storage call in individual try-catch to prevent cascading failures
    const [heroResult, recentResult, trendingResult, categoriesResult] = await Promise.allSettled([
      storage.getHomeHeroVideos(4, lang),
      storage.getRecentVideos(videosPerCategory, lang),
      storage.getTrendingVideos(videosPerCategory, lang),
      storage.getAllLocalizedCategories(lang),
    ]);

    // Extract results with fallbacks
    const hero = heroResult.status === 'fulfilled' ? heroResult.value : [];
    const recent = recentResult.status === 'fulfilled' ? recentResult.value : [];
    const trending = trendingResult.status === 'fulfilled' ? trendingResult.value : [];
    const allCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];

    // Log individual failures for debugging
    if (heroResult.status === 'rejected') {
      console.warn(`[carousels] Hero video fetch failed:`, heroResult.reason);
    }
    if (recentResult.status === 'rejected') {
      console.warn(`[carousels] Recent videos fetch failed:`, recentResult.reason);
    }
    if (trendingResult.status === 'rejected') {
      console.warn(`[carousels] Trending videos fetch failed:`, trendingResult.reason);
    }
    if (categoriesResult.status === 'rejected') {
      console.warn(`[carousels] Categories fetch failed:`, categoriesResult.reason);
    }

    // Process categories with individual error handling
    const limitedCategories = allCategories.slice(0, 10);
    const categoryPromises = limitedCategories.map(async (category) => {
      try {
        const videos = await storage.getVideosByCategory(category.id, videosPerCategory, lang);
        return {
          name: category.translations[0]?.name || 'Unnamed',
          videos: videos || [],
        };
      } catch (error) {
        console.warn(`[carousels] Failed to fetch videos for category ${category.id}:`, error);
        return {
          name: category.translations[0]?.name || 'Unnamed',
          videos: [],
        };
      }
    });
    
    const categoryResults = await Promise.allSettled(categoryPromises);
    const successfulCategories = categoryResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(result => result.videos.length > 0);

    const byCategory: Record<string, any[]> = {};
    for (const result of successfulCategories) {
      byCategory[result.name] = result.videos;
    }

    res.json({ hero, recent, trending, byCategory });
  } catch (error) {
    console.error(`[carousels] Critical error [params=${JSON.stringify(req.query)}]:`, error);
    // Even in case of critical error, return empty data instead of 500
    res.json({ hero: [], recent: [], trending: [], byCategory: {} });
  }
});

router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let video = await storage.getVideoWithRelationsBySlug(idOrSlug);
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

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, categoryIds, tags: tagNames } = req.body;
    const video = await storage.getVideo(req.params.id);

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const updates: { title?: string; description?: string } = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      await storage.updateVideo(req.params.id, updates);
    }

    if (categoryIds !== undefined) {
      await storage.removeVideoCategories(req.params.id);
      for (const categoryId of categoryIds) {
        await storage.addVideoCategory(req.params.id, categoryId);
      }
    }

    if (tagNames !== undefined) {
      await storage.deleteTagsByVideoId(req.params.id);
      for (const tagName of tagNames) {
        await storage.createTag(
          { videoId: req.params.id },
          [{ languageCode: "en", tagName }]
        );
      }
    }

    const updatedVideo = await storage.getVideoWithRelations(req.params.id);
    res.json(updatedVideo);
  } catch (error) {
    console.error("Update video error:", error);
    res.status(500).json({ error: "Failed to update video" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteVideo(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

router.post("/:id/categorize", requireAuth, async (req, res) => {
  try {
    const video = await storage.getVideo(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const result = await categorizeVideo(video.title, video.description || "");
    await storage.removeVideoCategories(video.id);
    await storage.deleteTagsByVideoId(video.id);

    for (const categoryName of result.categories) {
      const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let category = await storage.getLocalizedCategoryBySlug(slug, "en");

      if (!category) {
        category = await storage.createCategory(
          { videoCount: 0 },
          [{ languageCode: "en", name: categoryName, slug, description: "" }]
        );
      }

      await storage.addVideoCategory(video.id, category.id);
    }

    for (const tagName of result.tags) {
      await storage.createTag(
        { videoId: video.id },
        [{ languageCode: "en", tagName }]
      );
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error("Categorize video error:", error);
    res.status(500).json({ error: "Failed to categorize video" });
  }
});

router.post("/bulk/categorize", requireAuth, async (req, res) => {
  try {
    const { videoIds } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }

    const results = { total: videoIds.length, successful: 0, failed: 0, errors: [] as string[] };

    for (const videoId of videoIds) {
      try {
        const video = await storage.getVideo(videoId);
        if (!video) {
          results.failed++;
          results.errors.push(`Video ${videoId} not found`);
          continue;
        }

        const result = await categorizeVideo(video.title, video.description || "");
        await storage.removeVideoCategories(video.id);
        await storage.deleteTagsByVideoId(video.id);

        for (const categoryName of result.categories) {
          const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          let category = await storage.getLocalizedCategoryBySlug(slug, "en");
          if (!category) {
            category = await storage.createCategory(
              { videoCount: 0 },
              [{ languageCode: "en", name: categoryName, slug, description: "" }]
            );
          }
          await storage.addVideoCategory(video.id, category.id);
        }

        for (const tagName of result.tags) {
          await storage.createTag(
            { videoId: video.id },
            [{ languageCode: "en", tagName }]
          );
        }

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to categorize video ${videoId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Bulk categorize error:", error);
    res.status(500).json({ error: "Failed to bulk categorize videos" });
  }
});

router.post("/bulk/tag", requireAuth, async (req, res) => {
  try {
    const { videoIds, tags: tagNames } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }
    if (!Array.isArray(tagNames) || tagNames.length === 0) {
      return res.status(400).json({ error: "tags array is required" });
    }

    const results = { total: videoIds.length, successful: 0, failed: 0, errors: [] as string[] };

    for (const videoId of videoIds) {
      try {
        const video = await storage.getVideo(videoId);
        if (!video) {
          results.failed++;
          results.errors.push(`Video ${videoId} not found`);
          continue;
        }

        for (const tagName of tagNames) {
          await storage.createTag(
            { videoId: video.id },
            [{ languageCode: "en", tagName }]
          );
        }

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to tag video ${videoId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Bulk tag error:", error);
    res.status(500).json({ error: "Failed to bulk tag videos" });
  }
});

router.delete("/bulk", requireAuth, async (req, res) => {
  try {
    const { videoIds } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }

    const results = { total: videoIds.length, successful: 0, failed: 0, errors: [] as string[] };

    for (const videoId of videoIds) {
      try {
        await storage.deleteVideo(videoId);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to delete video ${videoId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({ error: "Failed to bulk delete videos" });
  }
});

router.post("/:id/like", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const allowed = await kvService.checkRateLimit(userIdentifier, 'like');
    if (!allowed) {
      return res.status(429).json({ error: "Too many like requests. Please slow down.", retryAfter: 60 });
    }

    const existingLike = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)))
      .limit(1);

    if (existingLike.length > 0) {
      return res.status(400).json({ error: "Already liked" });
    }

    await db.insert(videoLikes).values({ videoId, userIdentifier });
    await db.update(videos).set({ likesCount: sqlOp`${videos.likesCount} + 1` }).where(eq(videos.id, videoId));

    const [updatedVideo] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    res.json({ success: true, likesCount: updatedVideo?.likesCount || 0 });
  } catch (error) {
    console.error("Like video error:", error);
    res.status(500).json({ error: "Failed to like video" });
  }
});

router.delete("/:id/like", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const existingLike = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)))
      .limit(1);

    if (existingLike.length === 0) {
      return res.status(400).json({ error: "Not liked" });
    }

    await db.delete(videoLikes).where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)));
    await db.update(videos).set({ likesCount: sqlOp`GREATEST(${videos.likesCount} - 1, 0)` }).where(eq(videos.id, videoId));

    const [updatedVideo] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    res.json({ success: true, likesCount: updatedVideo?.likesCount || 0 });
  } catch (error) {
    console.error("Unlike video error:", error);
    res.status(500).json({ error: "Failed to unlike video" });
  }
});

router.get("/:id/like-status", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const existingLike = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)))
      .limit(1);

    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);

    res.json({ isLiked: existingLike.length > 0, likesCount: video?.likesCount || 0 });
  } catch (error) {
    console.error("Get like status error:", error);
    res.status(500).json({ error: "Failed to get like status" });
  }
});

router.post("/:id/view", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    await kvService.bufferView(videoId, userIdentifier);
    await db.insert(videoViews).values({ videoId, userIdentifier });

    res.json({ success: true });
  } catch (error) {
    console.error("Track view error:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
});

router.post("/batch/like-status", async (req, res) => {
  try {
    const { videoIds } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }

    const userIdentifier = getUserIdentifier(req);

    const userLikes = await db
      .select()
      .from(videoLikes)
      .where(and(inArray(videoLikes.videoId, videoIds), eq(videoLikes.userIdentifier, userIdentifier)));

    const videosData = await db
      .select({ id: videos.id, likesCount: videos.likesCount })
      .from(videos)
      .where(inArray(videos.id, videoIds));

    const result: Record<string, { isLiked: boolean; likesCount: number }> = {};
    for (const video of videosData) {
      result[video.id] = {
        isLiked: userLikes.some((like: any) => like.videoId === video.id),
        likesCount: video.likesCount || 0,
      };
    }

    res.json(result);
  } catch (error) {
    console.error("Batch get like status error:", error);
    res.status(500).json({ error: "Failed to get batch like status" });
  }
});

export default router;
