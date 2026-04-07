import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db.js";
import { activityLogs, channelRecommendations } from "../../shared/schema.js";
import { desc, eq, sql, and, or, like } from "drizzle-orm";

const router = Router();

// Get all inbox items (suggestions + channel recommendations) in one feed
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const tab = (req.query.tab as string) || "all"; // all, suggestions, channels
    const status = (req.query.status as string) || ""; // pending, approved, rejected, read, unread

    const results: any[] = [];

    // Fetch suggestions from activity_logs
    if (tab === "all" || tab === "suggestions") {
      try {
        let suggestionsQuery = db
          .select()
          .from(activityLogs)
          .where(
            like(activityLogs.action, "suggestion.%")
          )
          .orderBy(desc(activityLogs.createdAt))
          .limit(limit);

        const suggestions = await suggestionsQuery;

        for (const s of suggestions) {
          let parsed: any = {};
          try { parsed = JSON.parse(s.details || "{}"); } catch {}

          results.push({
            id: s.id,
            type: "suggestion",
            subType: parsed.type || "contact",
            subject: parsed.subject || "",
            message: parsed.message || "",
            email: parsed.email || null,
            sender: s.username || "anonymous",
            ip: s.ipAddress,
            status: "received",
            createdAt: s.createdAt,
          });
        }
      } catch (e) {
        // activity_logs table may not exist yet
      }
    }

    // Fetch channel recommendations
    if (tab === "all" || tab === "channels") {
      try {
        const channelRecs = await db
          .select()
          .from(channelRecommendations)
          .orderBy(desc(channelRecommendations.createdAt))
          .limit(limit);

        for (const r of channelRecs) {
          if (status && r.status !== status) continue;

          results.push({
            id: r.id,
            type: "channel_recommendation",
            subType: r.platform || "youtube",
            subject: r.url,
            message: r.description || "",
            email: null,
            sender: "visitor",
            ip: null,
            status: r.status,
            rejectionReason: r.rejectionReason,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
          });
        }
      } catch {}
    }

    // Sort by createdAt descending
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const paginated = results.slice(offset, offset + limit);

    // Count stats
    const pendingChannels = results.filter(r => r.type === "channel_recommendation" && r.status === "pending").length;
    const totalSuggestions = results.filter(r => r.type === "suggestion").length;
    const totalChannelRecs = results.filter(r => r.type === "channel_recommendation").length;

    res.json({
      items: paginated,
      total: results.length,
      stats: {
        pendingChannels,
        totalSuggestions,
        totalChannelRecs,
      },
    });
  } catch (error: any) {
    console.error("[inbox] Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch inbox" });
  }
});

// Delete a suggestion (activity log entry)
router.delete("/suggestions/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(activityLogs).where(eq(activityLogs.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
