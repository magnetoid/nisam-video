import { Router } from "express";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { tags } from "../../shared/schema.js";

const router = Router();

// Analytics Events Public Routes
router.get("/events", async (req, res) => {
  try {
    const events = await storage.getAnalyticsEvents();
    // Only return active events
    const activeEvents = events.filter(e => e.isActive === 1);
    res.json(activeEvents);
  } catch (error) {
    console.error("Error fetching analytics events:", error);
    res.status(500).json({ error: "Failed to fetch analytics events" });
  }
});

// Analytics routes
router.get("/", async (req, res) => {
  try {
    const { days } = req.query;
    const daysFilter = days ? parseInt(days as string) : undefined;

    // Get total counts
    const channels = await storage.getAllChannels();
    const allVideos = await storage.getAllVideos();
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
            categoryVideoCount.set(cat.id, { name: cat.name || "Unknown", count: 1 });
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

export default router;
