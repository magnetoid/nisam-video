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
      // Jimp v1+
      // The error "Unsupported MIME type: image/webp" means getBuffer doesn't know "image/webp"
      // or the MIME type constant is different.
      // In Jimp v1, we should import MIME_TYPES or similar.
      // But we can also use "image/png" or "image/jpeg" if webp is not supported out of the box?
      // Wait, Jimp supports webp but maybe it needs a plugin or explicit constant?
      // Actually, standard Jimp usually supports "image/png", "image/jpeg", "image/bmp", "image/tiff", "image/gif".
      // "image/webp" support might be missing in the core build or requires configuration.
      
      // Let's fallback to JPEG if WEBP fails.
      // Or better, let's check what mime types are supported.
      
      // Let's try "image/jpeg" which is universally supported.
      
      let resized;
      try {
          const targetWidth = Math.round(width);
          // Manually calculate height to be safe
          const targetHeight = Math.round(image.height * (targetWidth / image.width));
          
          // Try passing both w and h
          resized = image.resize({ w: targetWidth, h: targetHeight });
      } catch (resizeError) {
          console.error("Resize failed, using original image", resizeError);
          resized = image;
      }

      let outputBuffer;
      let contentType;
      
      try {
        // Try WebP first
        outputBuffer = await resized.getBuffer("image/webp", { quality: 80 });
        contentType = "image/webp";
      } catch (webpError) {
        // Fallback to JPEG if WebP is not supported by this Jimp version/environment
        // console.error("WebP conversion failed, falling back to JPEG", webpError);
        outputBuffer = await resized.getBuffer("image/jpeg", { quality: 80 });
        contentType = "image/jpeg";
      }

      // 3. Save to Cache (7 days)
      try {
        await setCache(cacheKey, outputBuffer.toString('base64'), 7 * 86400);
      } catch (e) {
        console.error("Cache write error:", e);
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(outputBuffer);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).send("Failed to process image");
  }
});

export default router;
