import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/update-thumbnails", requireAuth, async (req, res) => {
  try {
    const count = await storage.updateAllVideoThumbnails();
    res.json({
      success: true,
      updated: count,
      message: `Updated ${count} video thumbnails to high quality`,
    });
  } catch (error) {
    console.error("Update thumbnails error:", error);
    res.status(500).json({ error: "Failed to update thumbnails" });
  }
});

export default router;
