import { Router } from "express";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { tags, tagTranslations } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

function safeParseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

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
    const daysFilterRaw = typeof days === "string" ? parseInt(days, 10) : undefined;
    const daysFilter = typeof daysFilterRaw === "number" && !isNaN(daysFilterRaw) ? daysFilterRaw : undefined;

    // Get total counts
    const channels = await storage.getAllChannels();
    const allVideos = await storage.getAllVideos();
    const allTags = await db
      .select({ videoId: tags.videoId, tagName: tagTranslations.tagName })
      .from(tags)
      .innerJoin(tagTranslations, eq(tags.id, tagTranslations.tagId))
      .where(eq(tagTranslations.languageCode, "en"));

    // Filter by date if specified
    let filteredVideos = allVideos;
    if (daysFilter) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysFilter);
      filteredVideos = allVideos.filter((v) => {
        const publishDate = safeParseDate(v.publishDate);
        const createdAt = safeParseDate((v as any).createdAt);
        const effective = publishDate || createdAt;
        if (!effective) return false;
        return effective >= cutoffDate;
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
      if (!tag.tagName) continue;
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

    // Videos per day
    const videosPerDay = new Map<string, number>();
    for (const video of filteredVideos) {
      const publishDate = safeParseDate(video.publishDate);
      const createdAt = safeParseDate((video as any).createdAt);
      const effective = publishDate || createdAt;
      if (!effective) continue;
      const date = effective.toISOString().split("T")[0];
      videosPerDay.set(date, (videosPerDay.get(date) || 0) + 1);
    }
    const dailyGrowth = Array.from(videosPerDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

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
      dailyGrowth,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export default router;
