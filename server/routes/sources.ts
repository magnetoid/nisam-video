// Admin source-platform aggregation routes.
// Mounted at /api/admin/sources — gated by requireAuth.

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { SUPPORTED_PLATFORMS } from "../../shared/schema.js";

const router = Router();

interface SourceStatRow {
  platform: string;
  channelCount: number;
  videoCount: number;
}

router.get("/stats", requireAuth, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        c.platform AS platform,
        COUNT(DISTINCT c.id)::int AS channel_count,
        COUNT(v.id)::int AS video_count
      FROM channels c
      LEFT JOIN videos v ON v.channel_id = c.id
      GROUP BY c.platform
    `);

    const byPlatform = new Map<string, { channelCount: number; videoCount: number }>();
    for (const row of rows as any[]) {
      const platform = String(row.platform ?? "unknown");
      byPlatform.set(platform, {
        channelCount: Number(row.channel_count ?? 0),
        videoCount: Number(row.video_count ?? 0),
      });
    }

    // Surface every supported platform even when its row count is zero so the
    // UI can render a stable set of tabs/segments.
    const stats: SourceStatRow[] = SUPPORTED_PLATFORMS.map((platform) => ({
      platform,
      channelCount: byPlatform.get(platform)?.channelCount ?? 0,
      videoCount: byPlatform.get(platform)?.videoCount ?? 0,
    }));

    res.json({ stats });
  } catch (error) {
    console.error("[sources] stats query failed:", error);
    res.status(500).json({ error: "Failed to compute source stats" });
  }
});

export default router;
