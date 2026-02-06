import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth } from "../middleware/auth.js";
import { insertPlaylistSchema } from "../../shared/schema.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const data = insertPlaylistSchema.parse(req.body);
    const playlist = await storage.createPlaylist(data);
    res.json(playlist);
  } catch (error) {
    console.error("Create playlist error:", error);
    res.status(400).json({ error: "Failed to create playlist" });
  }
});

router.get("/", async (req, res) => {
  try {
    const playlists = await storage.getAllPlaylists();
    res.json(playlists);
  } catch (error) {
    console.error("Get playlists error:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const playlist = await storage.getPlaylistWithVideos(req.params.id);
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    res.json(playlist);
  } catch (error) {
    console.error("Get playlist error:", error);
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const playlist = await storage.updatePlaylist(req.params.id, req.body);
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    res.json(playlist);
  } catch (error) {
    console.error("Update playlist error:", error);
    res.status(500).json({ error: "Failed to update playlist" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await storage.deletePlaylist(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete playlist error:", error);
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

router.post("/:id/videos", requireAuth, async (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId) {
      return res.status(400).json({ error: "videoId is required" });
    }
    await storage.addVideoToPlaylist(req.params.id, videoId);
    res.json({ success: true });
  } catch (error) {
    console.error("Add video to playlist error:", error);
    res.status(500).json({ error: "Failed to add video to playlist" });
  }
});

router.delete(
  "/:id/videos/:videoId",
  requireAuth,
  async (req, res) => {
    try {
      await storage.removeVideoFromPlaylist(
        req.params.id,
        req.params.videoId,
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Remove video from playlist error:", error);
      res.status(500).json({ error: "Failed to remove video from playlist" });
    }
  },
);

export default router;
