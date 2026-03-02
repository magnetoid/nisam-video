import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage/index.js";

function suggestChannelNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "YouTube Channel";
    if (last.startsWith("@")) return last;
    if (parts[0] === "channel" && last) return `Channel ${last.slice(0, 12)}`;
    return last;
  } catch {
    return "YouTube Channel";
  }
}

const router = Router();

router.get("/channel-recommendations", requireAuth, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await storage.getChannelRecommendations({ status });
    const sorted = [...rows].sort((a, b) => {
      const ta = new Date(a.createdAt as any).getTime();
      const tb = new Date(b.createdAt as any).getTime();
      return tb - ta;
    });
    res.json(sorted);
  } catch (error) {
    console.error("[admin-channel-recommendations] List error:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

router.post("/channel-recommendations/:id/approve", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const recs = await storage.getChannelRecommendations({});
    const target = recs.find((r) => r.id === id);
    if (!target) return res.status(404).json({ error: "Recommendation not found" });

    const name = typeof req.body?.name === "string" && req.body.name.trim()
      ? req.body.name.trim()
      : suggestChannelNameFromUrl(target.url);

    const channel = await storage.createChannel({
      name,
      url: target.url,
      platform: "youtube",
    });

    const reviewedBy = (req.session as any)?.userId || null;
    const updated = await storage.reviewChannelRecommendation(id, {
      status: "approved",
      reviewedBy,
      approvedChannelId: channel.id,
      rejectionReason: null,
    });

    res.json({ recommendation: updated, channel });
  } catch (error) {
    console.error("[admin-channel-recommendations] Approve error:", error);
    res.status(400).json({ error: "Failed to approve recommendation" });
  }
});

router.post("/channel-recommendations/:id/reject", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : null;
    const reviewedBy = (req.session as any)?.userId || null;

    const updated = await storage.reviewChannelRecommendation(id, {
      status: "rejected",
      reviewedBy,
      rejectionReason: reason,
      approvedChannelId: null,
    });

    if (!updated) return res.status(404).json({ error: "Recommendation not found" });
    res.json(updated);
  } catch (error) {
    console.error("[admin-channel-recommendations] Reject error:", error);
    res.status(400).json({ error: "Failed to reject recommendation" });
  }
});

export default router;
