import { Router } from "express";
import { storage } from "../storage/index.js";
import { kvService } from "../kv-service.js";
import { getUserIdentifier } from "../utils.js";

const router = Router();

// Viewing history route (public)
router.get("/viewing-history", async (req, res) => {
  try {
    const userIdentifier = getUserIdentifier(req);
    const videoIds = await kvService.getViewingHistory(userIdentifier);
    
    // Fetch video details for the history
    if (videoIds.length === 0) {
      return res.json([]);
    }
    
    const videoDetails = await storage.getAllVideos();
    const historyVideos = videoIds
      .map(id => videoDetails.find(v => v.id === id))
      .filter(Boolean);
    
    res.json(historyVideos);
  } catch (error) {
    console.error("Get viewing history error:", error);
    res.status(500).json({ error: "Failed to get viewing history" });
  }
});

export default router;
