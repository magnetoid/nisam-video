import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage.js";
import { scrapeYouTubeChannel } from "../scraper.js";
import { categorizeVideo } from "../ai-service.js";
import { insertChannelSchema, videos } from "../../shared/schema.js";
import { generateSlug } from "../utils.js";
import { db } from "../db.js";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const data = insertChannelSchema.parse(req.body);
    const channel = await storage.createChannel(data);
    console.log(`[channels] Created channel: ${channel.name}`);
    res.json(channel);
  } catch (error) {
    console.error("[channels] Create error:", error);
    res.status(400).json({ error: "Failed to create channel" });
  }
});

router.get("/", async (req, res) => {
  try {
    const channels = await storage.getAllChannels();
    res.json(channels);
  } catch (error) {
    console.error("[channels] Fetch error:", error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteChannel(req.params.id);
    console.log(`[channels] Deleted channel: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[channels] Delete error:", error);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

router.post("/:id/scrape", requireAuth, async (req, res) => {
  try {
    const channel = await storage.getChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const { channelInfo, videos: scrapedVideos } = await scrapeYouTubeChannel(
      channel.url,
    );

    if (channelInfo.channelId || channelInfo.thumbnailUrl) {
      await storage.updateChannel(channel.id, {
        channelId: channelInfo.channelId || channel.channelId,
        thumbnailUrl: channelInfo.thumbnailUrl || channel.thumbnailUrl,
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
          videoType: scrapedVideo.videoType || "regular",
        });

        newVideos.push(newVideo.id);
        savedCount++;
      }
    }

    console.log(`[channels] Auto-categorizing ${newVideos.length} new videos...`);
    for (const videoId of newVideos) {
      try {
        const video = await storage.getVideo(videoId);
        if (!video) continue;

        const result = await categorizeVideo(
          video.title,
          video.description || "",
          { timeoutMs: 20000 },
        );

        for (const categoryName of result.categories) {
          const categorySlug = categoryName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
          let category = await storage.getLocalizedCategoryBySlug(categorySlug, 'en');

          if (!category) {
            category = await storage.createCategory({}, [{
              languageCode: 'en',
              name: categoryName,
              slug: categorySlug,
            }]);
          }

          await storage.addVideoCategory(video.id, category.id);
        }

        for (const tagName of result.tags) {
          await storage.createTag({
            videoId: video.id,
          }, [{
              languageCode: 'en',
              tagName
          }]);
        }

        console.log(`[channels] Categorized: ${video.title}`);
      } catch (error) {
        console.error(`[channels] Failed to categorize video ${videoId}:`, error);
      }
    }

    const allCategories = await storage.getAllLocalizedCategories('en');
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

    console.log(`[channels] Scrape complete for ${channel.name}: ${savedCount} new videos saved`);
    res.json({
      success: true,
      scraped: scrapedVideos.length,
      saved: savedCount,
    });
  } catch (error) {
    console.error("[channels] Scrape error:", error);
    res.status(500).json({ error: "Failed to scrape channel" });
  }
});

export default router;
