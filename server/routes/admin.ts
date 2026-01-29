import { Router, Request } from "express";
import { storage } from "../storage.js";
import { categorizeVideo, generateVideoSummary, generateSeoMetadata, openai } from "../ai-service.js";
import { requireAuth } from "../middleware/auth.js";
import { kvService } from "../kv-service.js";
import { generateSlug, ensureUniqueSlug } from "../utils.js";
import { ObjectStorageService } from "../replit_integrations/object_storage/index.js";

const router = Router();

function getUserIdentifier(req: Request): string {
  return req.sessionID || req.ip || "anonymous";
}

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    res.json({ message: "Use existing endpoints for stats" });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

router.get("/ai-status", requireAuth, async (_req, res) => {
  const hasOpenAIKey = Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  );

  res.json({
    openai: {
      configured: hasOpenAIKey,
      model: "gpt-5",
      baseUrlConfigured: Boolean(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL),
    },
  });
});

router.post("/regenerate", requireAuth, async (req, res) => {
  try {
    const type = (req.query.type as string) || "all";
    if (type !== "all" && type !== "categories" && type !== "tags") {
      return res.status(400).json({ error: "Invalid type" });
    }

    const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10) || 0);
    const limit = Math.min(
      5,
      Math.max(1, parseInt((req.query.limit as string) || "1", 10) || 1),
    );

    const videos = await storage.getAllVideos();
    const total = videos.length;
    const batch = videos.slice(offset, offset + limit);

    let processed = 0;
    let categoriesGenerated = 0;
    let tagsGenerated = 0;

    for (const video of batch) {
      try {
        const categorizeResult = await categorizeVideo(
          video.title,
          video.description || "",
        );

        if (type === "all" || type === "categories") {
          const categoryNames = Array.isArray(categorizeResult.categories)
            ? categorizeResult.categories
            : [];

          const normalized = Array.from(
            new Set(
              categoryNames
                .map((c) => (typeof c === "string" ? c.trim() : ""))
                .filter(Boolean),
            ),
          );

          const finalNames = normalized.length > 0 ? normalized.slice(0, 3) : ["Uncategorized"];
          const categoryIds: string[] = [];

          for (const categoryName of finalNames) {
            const slug = generateSlug(categoryName);
            let category = await storage.getCategoryBySlug(slug);
            if (!category) {
              category = await storage.createCategory({
                name: categoryName,
                slug,
                description: null,
              });
            }
            categoryIds.push(category.id);
          }

          if (categoryIds.length > 0) {
            await storage.removeVideoCategories(video.id);
            for (const categoryId of categoryIds) {
              await storage.addVideoCategory(video.id, categoryId);
              categoriesGenerated++;
            }
          }
        }

        if (type === "all" || type === "tags") {
          const tagNames = Array.isArray(categorizeResult.tags)
            ? categorizeResult.tags
            : [];

          const normalizedTags = Array.from(
            new Set(
              tagNames
                .map((t) => (typeof t === "string" ? t.trim() : ""))
                .filter(Boolean)
                .slice(0, 20),
            ),
          );

          if (normalizedTags.length > 0) {
            await storage.deleteTagsByVideoId(video.id);
            for (const tagName of normalizedTags) {
              await storage.createTag({ videoId: video.id, tagName });
              tagsGenerated++;
            }
          }
        }

        processed++;
      } catch (error) {
        console.error(`Error regenerating video ${video.id}:`, error);
      }
    }

    const { cache: cacheModule } = await import("../cache.js");
    cacheModule.clear();

    const nextOffset = Math.min(total, offset + limit);
    res.json({
      success: true,
      processed,
      categoriesGenerated,
      tagsGenerated,
      total,
      offset,
      limit,
      nextOffset,
      done: nextOffset >= total,
    });
  } catch (error) {
    console.error("Regeneration error:", error);
    res.status(500).json({ error: "Failed to regenerate content" });
  }
});

router.post("/videos/:id/generate-summary", requireAuth, async (req, res) => {
  try {
    const video = await storage.getVideo(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const summary = await generateVideoSummary(video.title, video.description || "");
    
    // Optionally save the summary if we add a field for it, for now just return it
    // Or append it to description? Let's just return it for the UI to handle
    res.json({ success: true, summary });
  } catch (error) {
    console.error("Generate summary error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

router.post("/videos/:id/generate-seo", requireAuth, async (req, res) => {
  try {
    const video = await storage.getVideo(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const seoData = await generateSeoMetadata(video.title, video.description || "");
    res.json({ success: true, seoData });
  } catch (error) {
    console.error("Generate SEO error:", error);
    res.status(500).json({ error: "Failed to generate SEO metadata" });
  }
});

router.post("/regenerate-slugs", requireAuth, async (req, res) => {
  try {
    const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10) || 0);
    const limit = Math.min(
      200,
      Math.max(1, parseInt((req.query.limit as string) || "200", 10) || 200),
    );

    const videos = await storage.getAllVideos();
    const total = videos.length;
    let processed = 0;
    const existingSlugs: string[] = [];

    for (const video of videos) {
      if (video.slug) existingSlugs.push(video.slug);
    }

    const batch = videos.slice(offset, offset + limit);
    for (const video of batch) {
      try {
        const baseSlug = generateSlug(video.title);
        const newSlug = ensureUniqueSlug(baseSlug, existingSlugs);

        if (newSlug !== video.slug) {
          await storage.updateVideo(video.id, { slug: newSlug });
          existingSlugs.push(newSlug);
          processed++;
        }
      } catch (error) {
        console.error(`Error regenerating slug for video ${video.id}:`, error);
      }
    }

    const { cache: cacheModule } = await import("../cache.js");
    cacheModule.clear();

    const nextOffset = Math.min(total, offset + limit);

    res.json({
      success: true,
      processed,
      total,
      offset,
      limit,
      nextOffset,
      done: nextOffset >= total,
      message: `Successfully regenerated ${processed} video URLs`,
    });
  } catch (error) {
    console.error("Slug regeneration error:", error);
    res.status(500).json({ error: "Failed to regenerate slugs" });
  }
});

router.get("/cache/stats", requireAuth, async (req, res) => {
  try {
    const { cache: cacheModule } = await import("../cache.js");
    const stats = cacheModule.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Get cache stats error:", error);
    res.status(500).json({ error: "Failed to get cache statistics" });
  }
});

router.post("/cache/clear", requireAuth, async (req, res) => {
  try {
    const { cache: cacheModule } = await import("../cache.js");
    cacheModule.clear();
    res.json({ success: true, message: "Cache cleared successfully" });
  } catch (error) {
    console.error("Clear cache error:", error);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

router.get("/cache/settings", requireAuth, async (req, res) => {
  try {
    const settings = await storage.getSystemSettings();
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

router.put("/cache/settings", requireAuth, async (req, res) => {
  try {
    const {
      cacheEnabled,
      cacheVideosTTL,
      cacheChannelsTTL,
      cacheCategoriesTTL,
      cacheApiTTL,
    } = req.body;

    const updateData: any = { updatedAt: new Date() };

    if (cacheEnabled !== undefined) {
      updateData.cacheEnabled = cacheEnabled ? 1 : 0;
      const { cache: cacheModule } = await import("../cache.js");
      cacheModule.setEnabled(cacheEnabled);
    }
    if (cacheVideosTTL !== undefined) updateData.cacheVideosTTL = cacheVideosTTL;
    if (cacheChannelsTTL !== undefined)
      updateData.cacheChannelsTTL = cacheChannelsTTL;
    if (cacheCategoriesTTL !== undefined)
      updateData.cacheCategoriesTTL = cacheCategoriesTTL;
    if (cacheApiTTL !== undefined) updateData.cacheApiTTL = cacheApiTTL;

    await storage.updateSystemSettings(updateData);

    res.json({ success: true, message: "Cache settings updated successfully" });
  } catch (error) {
    console.error("Update cache settings error:", error);
    res.status(500).json({ error: "Failed to update cache settings" });
  }
});

router.get("/kv/stats", requireAuth, async (req, res) => {
  try {
    const stats = await kvService.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Get KV stats error:", error);
    res.status(500).json({ error: "Failed to get KV store statistics" });
  }
});

router.post("/kv/flush-buffers", requireAuth, async (req, res) => {
  try {
    const flushed = await kvService.flushAllViewBuffers();
    res.json({
      success: true,
      message: `Flushed ${flushed} view buffer${flushed !== 1 ? "s" : ""}`,
      flushed,
    });
  } catch (error) {
    console.error("Flush buffers error:", error);
    res.status(500).json({ error: "Failed to flush view buffers" });
  }
});

router.post("/kv/cleanup", requireAuth, async (req, res) => {
  try {
    const cleaned = await kvService.cleanupRateLimits();
    res.json({
      success: true,
      message: `Cleaned ${cleaned} expired rate limit${cleaned !== 1 ? "s" : ""}`,
      cleaned,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: "Failed to cleanup KV store" });
  }
});

router.post("/tags/:tagName/generate-image", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const decodedTagName = decodeURIComponent(tagName);

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

    const result = await storage.updateTagImage({
      tagName: decodedTagName,
      imageUrl: generatedImageUrl,
      isAiGenerated: 1,
    });

    res.json(result);
  } catch (error) {
    console.error("Error generating tag image:", error);
    res.status(500).json({ error: "Failed to generate tag image" });
  }
});

router.post("/tags/:tagName/image", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const { imageUrl } = req.body;
    const decodedTagName = decodeURIComponent(tagName);

    if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required" });
    }

    let normalizedPath = imageUrl;
    try {
      const objectStorageService = new ObjectStorageService();
      normalizedPath = objectStorageService.normalizeObjectEntityPath(imageUrl);
    } catch {
      normalizedPath = imageUrl;
    }

    const result = await storage.updateTagImage({
      tagName: decodedTagName,
      imageUrl: normalizedPath,
      isAiGenerated: 0,
    });

    res.json(result);
  } catch (error) {
    console.error("Error saving tag image:", error);
    res.status(500).json({ error: "Failed to save tag image" });
  }
});

router.delete("/tags/:tagName/image", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const decodedTagName = decodeURIComponent(tagName);
    await storage.deleteTagImage(decodedTagName);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag image:", error);
    res.status(500).json({ error: "Failed to delete tag image" });
  }
});

// Hero Management Routes
router.get("/hero", requireAuth, async (_req, res) => {
  try {
    const heroVideos = await storage.getHeroVideos();
    res.json(heroVideos);
  } catch (error) {
    console.error("Error fetching hero videos:", error);
    res.status(500).json({ error: "Failed to fetch hero videos" });
  }
});

router.post("/hero", requireAuth, async (req, res) => {
  try {
    const heroVideos = req.body as InsertHeroVideo[];
    const updated = await storage.updateHeroVideos(heroVideos);
    res.json({ success: true, heroVideos: updated });
  } catch (error: any) {
    console.error("Error updating hero videos:", error);
    res.status(error.message.includes("Exactly 5") || error.message.includes("Slots") ? 400 : 500).json({ 
      error: error.message || "Failed to update hero videos" 
    });
  }
});

export default router;
