import { Router } from "express";
import { storage } from "../storage/index.js";

const router = Router();

// Shorts routes (YouTube Shorts and TikTok)
router.get("/", async (req, res) => {
  try {
    const { type, limit, offset, lang } = req.query;
    const filters: { type?: "youtube_short" | "tiktok"; limit?: number; offset?: number; lang?: string } = {};
    
    if (type === "youtube_short" || type === "tiktok") {
      filters.type = type;
    }
    if (limit) {
      const parsedLimit = parseInt(limit as string, 10);
      filters.limit = Math.min(Math.max(isNaN(parsedLimit) ? 50 : parsedLimit, 1), 100);
    }
    if (offset) {
      const parsedOffset = parseInt(offset as string, 10);
      filters.offset = Math.max(isNaN(parsedOffset) ? 0 : parsedOffset, 0);
    }
    if (lang && typeof lang === "string") {
      filters.lang = lang;
    }
    
    const shorts = await storage.getShorts(filters);
    res.json(shorts);
  } catch (error) {
    console.error("Get shorts error:", error);
    res.status(500).json({ error: "Failed to fetch shorts" });
  }
});

export default router;
