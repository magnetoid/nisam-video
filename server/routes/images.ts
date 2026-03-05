import { Router } from "express";
import { Jimp } from "jimp";
import { getCache, setCache } from "../services/redis.js";

const router = Router();

router.get("/proxy", async (req, res) => {
  const url = req.query.url as string;
  const widthParam = req.query.width;
  const width = widthParam ? parseInt(widthParam as string, 10) : 640;
  
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

  // Include width in cache key to support multiple sizes
  const cacheKey = `img:${url}:${width}`;
  
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Failed to fetch image");
      
      const buffer = await response.arrayBuffer();
      const image = await Jimp.read(Buffer.from(buffer));
      const webpBuffer = await image
        .resize(width, Jimp.AUTO) // keep aspect ratio
        .quality(80)
        .getBufferAsync(Jimp.MIME_WEBP);

      // 3. Save to Cache (7 days)
      await setCache(cacheKey, webpBuffer.toString('base64'), 7 * 86400);

      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(webpBuffer);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).send("Failed to process image");
  }
});

export default router;
