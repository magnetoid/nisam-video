import { Router, Request } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { tags, tagImages, systemSettings, activityLogs } from "@shared/schema";
import { categorizeVideo } from "../ai-service";
import { requireAuth } from "../middleware/auth";
import { kvService } from "../kv-service";
import { generateSlug, ensureUniqueSlug } from "../utils";
import { eq, sql as sqlOp } from "drizzle-orm";
import OpenAI from "openai";
import { ObjectStorageService } from "../replit_integrations/object_storage";

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

router.post("/regenerate", requireAuth, async (req, res) => {
  try {
    const type = (req.query.type as string) || "all";
    const videos = await storage.getAllVideos();

    let processed = 0;
    let categoriesGenerated = 0;
    let tagsGenerated = 0;

    for (const video of videos) {
      try {
        if (type === "all" || type === "categories" || type === "tags") {
          if (type === "all" || type === "categories") {
            await storage.removeVideoCategories(video.id);
          }
          if (type === "all" || type === "tags") {
            await storage.deleteTagsByVideoId(video.id);
          }

          const categorizeResult = await categorizeVideo(video.title, video.description || "");

          if ((type === "all" || type === "categories") && categorizeResult.categories) {
            for (const categorySlug of categorizeResult.categories) {
              const category = await storage.getCategoryBySlug(categorySlug);
              if (category) {
                await storage.addVideoCategory(video.id, category.id);
                categoriesGenerated++;
              }
            }
          }

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
      }
    }

    const { cache: cacheModule } = await import("../cache");
    cacheModule.clear();

    res.json({ success: true, processed, categoriesGenerated, tagsGenerated });
  } catch (error) {
    console.error("Regeneration error:", error);
    res.status(500).json({ error: "Failed to regenerate content" });
  }
});

router.post("/regenerate-slugs", requireAuth, async (req, res) => {
  try {
    const videos = await storage.getAllVideos();
    let processed = 0;
    const existingSlugs: string[] = [];

    for (const video of videos) {
      if (video.slug) existingSlugs.push(video.slug);
    }

    for (const video of videos) {
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

    const { cache: cacheModule } = await import("../cache");
    cacheModule.clear();

    res.json({ success: true, processed, message: `Successfully regenerated ${processed} video URLs` });
  } catch (error) {
    console.error("Slug regeneration error:", error);
    res.status(500).json({ error: "Failed to regenerate slugs" });
  }
});

router.get("/cache/stats", requireAuth, async (req, res) => {
  try {
    const { cache: cacheModule } = await import("../cache");
    const stats = cacheModule.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Get cache stats error:", error);
    res.status(500).json({ error: "Failed to get cache statistics" });
  }
});

router.post("/cache/clear", requireAuth, async (req, res) => {
  try {
    const { cache: cacheModule } = await import("../cache");
    cacheModule.clear();
    res.json({ success: true, message: "Cache cleared successfully" });
  } catch (error) {
    console.error("Clear cache error:", error);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

router.get("/cache/settings", requireAuth, async (req, res) => {
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

router.put("/cache/settings", requireAuth, async (req, res) => {
  try {
    const { cacheEnabled, cacheVideosTTL, cacheChannelsTTL, cacheCategoriesTTL, cacheApiTTL } = req.body;

    const [existingSettings] = await db.select().from(systemSettings).limit(1);
    const updateData: any = { updatedAt: new Date() };

    if (cacheEnabled !== undefined) {
      updateData.cacheEnabled = cacheEnabled ? 1 : 0;
      const { cache: cacheModule } = await import("../cache");
      cacheModule.setEnabled(cacheEnabled);
    }
    if (cacheVideosTTL !== undefined) updateData.cacheVideosTTL = cacheVideosTTL;
    if (cacheChannelsTTL !== undefined) updateData.cacheChannelsTTL = cacheChannelsTTL;
    if (cacheCategoriesTTL !== undefined) updateData.cacheCategoriesTTL = cacheCategoriesTTL;
    if (cacheApiTTL !== undefined) updateData.cacheApiTTL = cacheApiTTL;

    if (!existingSettings) {
      await db.insert(systemSettings).values(updateData);
    } else {
      await db.update(systemSettings).set(updateData).where(eq(systemSettings.id, existingSettings.id));
    }

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
    res.json({ success: true, message: `Flushed ${flushed} view buffer${flushed !== 1 ? 's' : ''}`, flushed });
  } catch (error) {
    console.error("Flush buffers error:", error);
    res.status(500).json({ error: "Failed to flush view buffers" });
  }
});

router.post("/kv/cleanup", requireAuth, async (req, res) => {
  try {
    const cleaned = await kvService.cleanupRateLimits();
    res.json({ success: true, message: `Cleaned ${cleaned} expired rate limit${cleaned !== 1 ? 's' : ''}`, cleaned });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: "Failed to cleanup KV store" });
  }
});

router.post("/tags/:tagName/generate-image", requireAuth, async (req, res) => {
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
      [result] = await db.update(tagImages).set({ imageUrl: generatedImageUrl, isAiGenerated: 1 }).where(eq(tagImages.tagName, decodedTagName)).returning();
    } else {
      [result] = await db.insert(tagImages).values({ tagName: decodedTagName, imageUrl: generatedImageUrl, isAiGenerated: 1 }).returning();
    }
    
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

    const objectStorageService = new ObjectStorageService();
    const normalizedPath = objectStorageService.normalizeObjectEntityPath(imageUrl);
    
    const existingImage = await db.select().from(tagImages).where(eq(tagImages.tagName, decodedTagName)).limit(1);
    
    let result;
    if (existingImage.length > 0) {
      [result] = await db.update(tagImages).set({ imageUrl: normalizedPath, isAiGenerated: 0 }).where(eq(tagImages.tagName, decodedTagName)).returning();
    } else {
      [result] = await db.insert(tagImages).values({ tagName: decodedTagName, imageUrl: normalizedPath, isAiGenerated: 0 }).returning();
    }
    
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
    await db.delete(tagImages).where(eq(tagImages.tagName, decodedTagName));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag image:", error);
    res.status(500).json({ error: "Failed to delete tag image" });
  }
});

export default router;
