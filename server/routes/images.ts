import { Router } from "express";
import sharp from "sharp";
import { getCache, setCache } from "../services/redis.js";

const router = Router();

router.get("/proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("Missing URL");

  // Validacija URL-a (samo ytimg.com i slično)
  try {
    const parsedUrl = new URL(url);
    const allowedDomains = ["i.ytimg.com", "img.youtube.com", "yt3.ggpht.com"];
    if (!allowedDomains.some(d => parsedUrl.hostname.endsWith(d))) {
      return res.status(403).send("Forbidden domain");
    }
  } catch (e) {
    return res.status(400).send("Invalid URL");
  }

  const cacheKey = `img:${url}`;
  
  // 1. Try Cache
  try {
    const cached = await getCache<string>(cacheKey); // Base64 string
    if (cached) {
      const imgBuffer = Buffer.from(cached, 'base64');
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(imgBuffer);
    }
  } catch (e) {
    console.error("Cache read error", e);
  }

  // 2. Fetch & Convert
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image");
    
    const buffer = await response.arrayBuffer();
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 640, withoutEnlargement: true }) // Optimizacija velicine
      .webp({ quality: 80 })
      .toBuffer();

    // 3. Save to Cache (7 days)
    // Store as base64 in Redis
    await setCache(cacheKey, optimizedBuffer.toString('base64'), 7 * 86400);

    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(optimizedBuffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).send("Failed to process image");
  }
});

export default router;
