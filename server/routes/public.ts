import { Router } from "express";
import { storage } from "../storage/index.js";
import { cache } from "../cache.js";

const router = Router();

// Public Hero Random Images
router.get("/hero/random", async (_req, res) => {
  try {
    const result =
      typeof (storage as any).getRandomHeroImages === "function"
        ? await (storage as any).getRandomHeroImages()
        : null;
    if (!result) {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
      return res.json({
        images: [],
        settings: {
          id: "default",
          fallbackImages: [],
          rotationInterval: 4000,
          animationType: "fade",
          defaultPlaceholderUrl: null,
          enableRandom: true,
          enableImages: true,
          updatedAt: new Date(),
        },
      });
    }
    // Set short cache for randomness
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    res.json(result);
  } catch (error) {
    console.error("Error fetching random hero images:", error);
    res.status(500).json({ error: "Failed to fetch random hero images" });
  }
});

router.get("/hero/random-video", async (req, res) => {
  try {
    const lang = typeof req.query.lang === "string" ? req.query.lang : "en";
    const cacheKey = `hero:random-video:${lang}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
      return res.json(cached);
    }

    const candidates = await storage.getRecentVideos(50, lang).catch(() => []);
    const picked = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;

    if (!picked) {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
      const empty = { video: null, embedUrl: null };
      cache.set(cacheKey, empty, 30000);
      return res.json(empty);
    }

    const isTikTok = picked.videoType === "tiktok";
    const embedUrl = isTikTok
      ? (picked.embedUrl || `https://www.tiktok.com/embed/v2/${picked.videoId}`)
      : `https://www.youtube.com/embed/${picked.videoId}`;

    const payload = { video: picked, embedUrl };
    cache.set(cacheKey, payload, 30000);

    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    res.json(payload);
  } catch (error) {
    console.error("Error fetching random hero video:", error);
    res.status(500).json({ error: "Failed to fetch random hero video" });
  }
});

export default router;
