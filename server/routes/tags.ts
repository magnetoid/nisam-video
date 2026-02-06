import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth } from "../middleware/auth.js";
import { insertTagTranslationSchema, tags, tagImages, tagTranslations } from "../../shared/schema.js";
import { db } from "../db.js";
import { eq, inArray } from "drizzle-orm";
import { ObjectStorageService } from "../replit_integrations/object_storage/index.js";
// Use the shared OpenAI service instead of direct import
import { openai } from "../ai-service.js";

const router = Router();

// Tags routes (Multilingual)
router.get("/", async (req, res) => {
  try {
    const lang = (req.query.lang as string) || "en";
    const tags = await storage.getAllLocalizedTags(lang);
    res.json(tags);
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { tagName, translations } = req.body;
    
    let transList = translations;
    if (!transList && tagName) {
      transList = [{
        languageCode: 'en',
        tagName: tagName
      }];
    }

    if (!transList || !Array.isArray(transList) || transList.length === 0) {
      return res.status(400).json({ error: "Valid translations or tagName required" });
    }

    try {
      transList = transList.map((t: any) => insertTagTranslationSchema.parse(t));
    } catch (e) {
      return res.status(400).json({ error: "Invalid translation data", details: e });
    }

    return res.status(501).json({ error: "Tag creation requires video context. Use video update." });
  } catch (error) {
    console.error("Create tag error:", error);
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// Tags management routes
router.get("/stats", async (req, res) => {
  try {
    const allTags = await db.select({
      videoId: tags.videoId,
      tagName: tagTranslations.tagName
    })
    .from(tags)
    .innerJoin(tagTranslations, eq(tags.id, tagTranslations.tagId))
    .where(eq(tagTranslations.languageCode, 'en'));

    const tagCounts = allTags.reduce<Record<string, { tagName: string; count: number; videoIds: string[] }>>(
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

router.delete("/:tagName", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const tagsToDelete = await db.select({ id: tagTranslations.tagId })
      .from(tagTranslations)
      .where(eq(tagTranslations.tagName, tagName));

    if (tagsToDelete.length > 0) {
      const ids = tagsToDelete.map(t => t.id);
      await db.delete(tags).where(inArray(tags.id, ids));
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

router.get("/images", async (req, res) => {
  try {
    const images = await db.select().from(tagImages);
    res.json(images);
  } catch (error) {
    console.error("Error fetching tag images:", error);
    res.status(500).json({ error: "Failed to fetch tag images" });
  }
});

router.post("/:tagName/generate-image", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const decodedTagName = decodeURIComponent(tagName);
    
    // Note: This relies on the shared OpenAI instance which might be a mock or Ollama
    // Ollama generally doesn't support image generation unless configured with a multimodal model
    // but the shared 'openai' export handles the fallback/mock behavior.
    
    const prompt = `Abstract artistic background representing "${decodedTagName}", modern digital art style, vibrant colors, suitable for a video streaming platform hero section, 16:9 aspect ratio, no text`;
    
    // Image generation is not supported by standard text-only LLMs (Ollama)
    // We return a 501 Not Implemented or a placeholder if desired.
    // For now, we'll return an error to indicate it's not available.
    
    return res.status(501).json({ 
      error: "Image generation is not supported with the current local LLM provider.",
      code: "NOT_IMPLEMENTED"
    });
    
    /* 
    // Legacy OpenAI implementation for reference:
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });
    
    const generatedImageUrl = response.data?.[0]?.url;
    // ...
    */
  } catch (error) {
    console.error("Error generating tag image:", error);
    res.status(500).json({ error: "Failed to generate tag image. Image generation may not be supported by the current AI provider." });
  }
});

router.post("/:tagName/image", requireAuth, async (req, res) => {
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

router.delete("/:tagName/image", requireAuth, async (req, res) => {
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

router.put("/:tagName/translate", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const { languageCode, translation } = req.body;

    if (!languageCode || !translation) {
      return res.status(400).json({ error: "Language code and translation required" });
    }

    const allTags = await storage.getAllLocalizedTags('en');
    const matchingTags = allTags.filter(t => t.translations.some(tr => tr.tagName === tagName));
    
    if (matchingTags.length === 0) {
        return res.status(404).json({ error: "No tags found with this name" });
    }

    let updatedCount = 0;
    for (const tag of matchingTags) {
        try {
            await storage.addTagTranslation(tag.id, {
                tagId: tag.id,
                languageCode,
                tagName: translation
            });
            updatedCount++;
        } catch (e) {
            await storage.updateLocalizedTag(tag.id, languageCode, {
                tagName: translation
            });
            updatedCount++;
        }
    }

    res.json({ success: true, updatedCount });
  } catch (error) {
    console.error("Translate tag error:", error);
    res.status(500).json({ error: "Failed to translate tags" });
  }
});

export default router;
