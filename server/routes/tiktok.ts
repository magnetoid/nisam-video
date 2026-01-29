import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage.js";
import { scrapeTikTokProfile } from "../tiktok-scraper.js";
import { categorizeVideo } from "../ai-service.js";
import { insertChannelSchema, videos } from "../../shared/schema.js";
import { generateSlug } from "../utils.js";
import { db } from "../db.js";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const profiles = await storage.getChannelsByPlatform("tiktok");
    res.json(profiles);
  } catch (error) {
    console.error("[tiktok] Fetch profiles error:", error);
    res.status(500).json({ error: "Failed to fetch TikTok profiles" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const data = insertChannelSchema.parse({
      ...req.body,
      platform: "tiktok",
    });
    const profile = await storage.createChannel(data);
    console.log(`[tiktok] Created profile: ${profile.name}`);
    res.json(profile);
  } catch (error) {
    console.error("[tiktok] Create profile error:", error);
    res.status(400).json({ error: "Failed to create TikTok profile" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteChannel(req.params.id);
    console.log(`[tiktok] Deleted profile: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[tiktok] Delete profile error:", error);
    res.status(500).json({ error: "Failed to delete TikTok profile" });
  }
});

router.post("/:id/scrape", requireAuth, async (req, res) => {
  try {
    const channel = await storage.getChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "TikTok profile not found" });
    }

    const { profileInfo, videos: scrapedVideos } = await scrapeTikTokProfile(channel.url);

    if (profileInfo.username || profileInfo.avatarUrl) {
      await storage.updateChannel(channel.id, {
        channelId: profileInfo.username || channel.channelId,
        thumbnailUrl: profileInfo.avatarUrl || channel.thumbnailUrl,
        lastScraped: new Date(),
      });
    }

    let savedCount = 0;
    const newVideos: string[] = [];

    for (const scrapedVideo of scrapedVideos) {
      const existing = await storage.getVideoByVideoId(scrapedVideo.videoId);
      if (!existing) {
        const baseSlug = generateSlug(scrapedVideo.title);

        let slug = baseSlug;
        let counter = 1;
        while (true) {
          const existingSlug = await db
            .select()
            .from(videos)
            .where(eq(videos.slug, slug))
            .limit(1);
          if (existingSlug.length === 0) break;
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        const newVideo = await storage.createVideo({
          channelId: channel.id,
          videoId: scrapedVideo.videoId,
          slug,
          title: scrapedVideo.title,
          description: scrapedVideo.description || null,
          thumbnailUrl: scrapedVideo.thumbnailUrl,
          duration: scrapedVideo.duration || null,
          viewCount: scrapedVideo.viewCount || null,
          publishDate: scrapedVideo.publishDate || null,
          videoType: "tiktok",
          embedUrl: scrapedVideo.embedUrl,
        });

        newVideos.push(newVideo.id);
        savedCount++;
      }
    }

    console.log(`[tiktok] Auto-categorizing ${newVideos.length} new videos...`);
    for (const videoId of newVideos) {
      try {
        const video = await storage.getVideo(videoId);
        if (!video) continue;

        const result = await categorizeVideo(
          video.title,
          video.description || "",
        );

        for (const categoryName of result.categories) {
          const categorySlug = categoryName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
          let category = await storage.getCategoryBySlug(categorySlug);

          if (!category) {
            category = await storage.createCategory({
              name: categoryName,
              slug: categorySlug,
            });
          }

          await storage.addVideoCategory(video.id, category.id);
        }

        for (const tagName of result.tags) {
          await storage.createTag({
            videoId: video.id,
            tagName,
          });
        }

        console.log(`[tiktok] Categorized: ${video.title}`);
      } catch (error) {
        console.error(`[tiktok] Failed to categorize video ${videoId}:`, error);
      }
    }

    const allCategories = await storage.getAllCategories();
    for (const category of allCategories) {
      const categoryVideos = await storage.getAllVideos({
        categoryId: category.id,
      });
      await storage.updateCategory(category.id, {
        videoCount: categoryVideos.length,
      });
    }

    const allChannelVideos = await storage.getAllVideos({
      channelId: channel.id,
    });
    await storage.updateChannel(channel.id, {
      videoCount: allChannelVideos.length,
    });

    console.log(`[tiktok] Scrape complete for ${channel.name}: ${savedCount} new videos saved`);
    res.json({
      success: true,
      scraped: scrapedVideos.length,
      saved: savedCount,
    });
  } catch (error) {
    console.error("[tiktok] Scrape error:", error);
    res.status(500).json({ error: "Failed to scrape TikTok profile" });
  }
});

export default router;
