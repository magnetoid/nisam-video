import { Router } from "express";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { tags, tagTranslations, channels as channelsTable, videos as videosTable } from "../../shared/schema.js";
import { eq, sql } from "drizzle-orm";

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

    const [channelCountResult, videoCountResult] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(channelsTable),
      db.select({ count: sql`count(*)` }).from(videosTable)
    ]);
    const channelCount = Number(channelCountResult[0]?.count || 0);
    const totalVideosCount = Number(videoCountResult[0]?.count || 0);

    // If we have a days filter, get the count of videos in that range
    let filteredVideoCount = totalVideosCount;
    if (daysFilter) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysFilter);
      const filteredResult = await db.select({ count: sql`count(*)` })
        .from(videosTable)
        .where(sql`COALESCE(${videosTable.publishDate}, ${videosTable.createdAt}) >= ${cutoffDate}`);
      filteredVideoCount = Number(filteredResult[0]?.count || 0);
    }

    // Top categories by video count
    const topCategoriesQuery = await db.execute(sql`
      SELECT t.name, COUNT(vc.video_id) as count
      FROM video_categories vc
      JOIN category_translations t ON vc.category_id = t.category_id
      JOIN videos v ON vc.video_id = v.id
      WHERE t.language_code = 'en'
      ${daysFilter ? sql`AND COALESCE(v.publish_date, v.created_at) >= NOW() - INTERVAL '${sql.raw(daysFilter.toString())} days'` : sql``}
      GROUP BY t.name
      ORDER BY count DESC
      LIMIT 5
    `);
    const topCategories = topCategoriesQuery.map((row: any) => ({ name: row.name, count: Number(row.count) }));

    // Channel performance (videos per channel)
    const channelPerformanceQuery = await db.execute(sql`
      SELECT c.name, COUNT(v.id) as count
      FROM channels c
      LEFT JOIN videos v ON c.id = v.channel_id
      ${daysFilter ? sql`AND COALESCE(v.publish_date, v.created_at) >= NOW() - INTERVAL '${sql.raw(daysFilter.toString())} days'` : sql``}
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 10
    `);
    const channelPerformance = channelPerformanceQuery.map((row: any) => ({ name: row.name, videoCount: Number(row.count) }));

    // Tag frequency
    const tagFrequencyQuery = await db.execute(sql`
      SELECT tt.tag_name, COUNT(t.video_id) as count
      FROM tags t
      JOIN tag_translations tt ON t.id = tt.tag_id
      JOIN videos v ON t.video_id = v.id
      WHERE tt.language_code = 'en'
      ${daysFilter ? sql`AND COALESCE(v.publish_date, v.created_at) >= NOW() - INTERVAL '${sql.raw(daysFilter.toString())} days'` : sql``}
      GROUP BY tt.tag_name
      ORDER BY count DESC
      LIMIT 20
    `);
    const topTags = tagFrequencyQuery.map((row: any) => ({ name: row.tag_name, count: Number(row.count) }));

    // Category distribution
    const categoryDistributionQuery = await db.execute(sql`
      SELECT t.name, COUNT(vc.video_id) as count
      FROM video_categories vc
      JOIN category_translations t ON vc.category_id = t.category_id
      JOIN videos v ON vc.video_id = v.id
      WHERE t.language_code = 'en'
      ${daysFilter ? sql`AND COALESCE(v.publish_date, v.created_at) >= NOW() - INTERVAL '${sql.raw(daysFilter.toString())} days'` : sql``}
      GROUP BY t.name
      ORDER BY count DESC
    `);
    const categoryDistribution = categoryDistributionQuery.map((row: any) => ({ name: row.name, count: Number(row.count) }));

    // Videos per day
    const dailyGrowthQuery = await db.execute(sql`
      SELECT DATE(COALESCE(publish_date, created_at)) as date, COUNT(id) as count
      FROM videos
      ${daysFilter ? sql`WHERE COALESCE(publish_date, created_at) >= NOW() - INTERVAL '${sql.raw(daysFilter.toString())} days'` : sql``}
      GROUP BY DATE(COALESCE(publish_date, created_at))
      ORDER BY date ASC
    `);
    const dailyGrowth = dailyGrowthQuery.map((row: any) => ({ 
      date: new Date(row.date).toISOString().split("T")[0], 
      count: Number(row.count) 
    }));

    // Calculate filtered totals
    const uniqueChannelsResult = await db.execute(sql`
      SELECT COUNT(DISTINCT channel_id) as count FROM videos
      ${daysFilter ? sql`WHERE COALESCE(publish_date, created_at) >= NOW() - INTERVAL '${sql.raw(daysFilter.toString())} days'` : sql``}
    `);
    
    const uniqueCategoriesResult = await db.execute(sql`
      SELECT COUNT(DISTINCT vc.category_id) as count 
      FROM video_categories vc
      JOIN videos v ON vc.video_id = v.id
      ${daysFilter ? sql`WHERE COALESCE(v.publish_date, v.created_at) >= NOW() - INTERVAL '${sql.raw(daysFilter.toString())} days'` : sql``}
    `);

    res.json({
      totals: {
        channels: Number(uniqueChannelsResult[0]?.count || 0),
        videos: filteredVideoCount,
        categories: Number(uniqueCategoriesResult[0]?.count || 0),
        tags: topTags.reduce((sum: number, t: any) => sum + t.count, 0),
        allTimeVideos: totalVideosCount,
      },
      topCategories,
      channelPerformance: channelPerformance.sort(
        (a: any, b: any) => b.videoCount - a.videoCount,
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
