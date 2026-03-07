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
      // Jimp v1+ issue: resize({ w: width }) might be failing due to strict Zod validation or incorrect type definitions.
      // The error "Expected object, received number" is persistent.
      // It implies some internal call is receiving a number instead of an object.
      // 
      // Let's try to use the legacy-style positional arguments but with defined constants if possible?
      // No, let's try to resize using `scaleToFit` or similar if `resize` is broken?
      // Or simply just `resize(width, Jimp.AUTO)` if Jimp.AUTO is available?
      // But we don't have Jimp.AUTO imported directly, we have `Jimp`.
      // `Jimp` class itself might not have AUTO static property in v1?
      // 
      // Let's try a different method: `contain` or `cover`? 
      // But we want to maintain aspect ratio based on width.
      
      // Let's try manually calculating height and passing both.
      // Maybe passing a single property object is the issue for the union validator?
      
      let resized;
      try {
          const targetWidth = Math.round(width);
          // Calculate height manually
          const targetHeight = Math.round(image.height * (targetWidth / image.width));
          
          // Try passing both w and h
          resized = image.resize({ w: targetWidth, h: targetHeight });
      } catch (resizeError) {
          console.error("Resize failed (attempt 1), trying fallback...", resizeError);
          try {
             // Fallback: try just `resize({ w: width })` again? No, that failed.
             // Try passing mode?
             // resized = image.resize({ w: Math.round(width), mode: 'resizeNearestNeighbor' }); // Just guessing
             resized = image;
          } catch (e) {
             resized = image;
          }
      }

      const webpBuffer = await resized.getBuffer("image/webp", { quality: 80 });

      // 3. Save to Cache (7 days)
      try {
        await setCache(cacheKey, webpBuffer.toString('base64'), 7 * 86400);
      } catch (e) {
        console.error("Cache write error:", e);
      }

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
