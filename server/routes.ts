import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage/index.js";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage/index.js";
import { registerFeatureRoutes } from "./routes/index.js";
import { db, isDbReady } from "./db.js";
import { seoSettings } from "../shared/schema.js";
import { generateSlug } from "./utils.js";
import { getCache, setCache } from "./services/redis.js";
import imageRouter from "./routes/images.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Image proxy
  app.use("/api/images", imageRouter);

  // Register object storage routes
  registerObjectStorageRoutes(app);
  
  // Register modular feature routes (auth, channels, tiktok, videos, etc.)
  registerFeatureRoutes(app);

  // SEO Routes - Sitemap and Robots
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = "https://nisam.video";
      const lang = typeof (req.query as any)?.lang === "string" ? String((req.query as any).lang) : "en";
      const maxVideosRaw = typeof (req.query as any)?.maxVideos === "string" ? String((req.query as any).maxVideos) : "";
      const maxVideos = Number.isFinite(parseInt(maxVideosRaw || "", 10)) ? Math.max(0, parseInt(maxVideosRaw, 10)) : 0;

      const includeVideos = String((req.query as any)?.includeVideos ?? "1") !== "0";
      const includeCategories = String((req.query as any)?.includeCategories ?? "1") !== "0";
      const includeTags = String((req.query as any)?.includeTags ?? "1") !== "0";
      const includeChannels = String((req.query as any)?.includeChannels ?? "1") !== "0";

      // Try Redis Cache
      const cacheKey = `sitemap:xml:${lang}:${maxVideos}:${includeVideos ? 1 : 0}:${includeCategories ? 1 : 0}:${includeTags ? 1 : 0}:${includeChannels ? 1 : 0}`;
      try {
        const cachedSitemap = await getCache<string>(cacheKey);
        if (cachedSitemap) {
          res.header("Content-Type", "application/xml");
          res.header("X-Cache", "HIT-REDIS");
          return res.send(cachedSitemap);
        }
      } catch (err) {
        console.error("Redis cache error:", err);
      }

      const [videos, categories, tags, channels] = await Promise.all([
        includeVideos && maxVideos !== 0
          ? storage.getAllVideos({
              lang,
              limit: maxVideos > 0 ? maxVideos : undefined,
              sort: "createdAt",
            })
          : Promise.resolve([]),
        includeCategories ? storage.getAllLocalizedCategories(lang) : Promise.resolve([]),
        includeTags ? storage.getAllLocalizedTags(lang) : Promise.resolve([]),
        includeChannels ? storage.getAllChannels() : Promise.resolve([]),
      ]);

      const escapeXml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&apos;");

      // Build sitemap XML
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
      sitemap +=
        'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';

      // Homepage
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/</loc>\n`;
      sitemap += "    <changefreq>daily</changefreq>\n";
      sitemap += "    <priority>1.0</priority>\n";
      sitemap += "  </url>\n";

      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/channels</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.7</priority>\n";
      sitemap += "  </url>\n";

      // Categories page
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/categories</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.8</priority>\n";
      sitemap += "  </url>\n";

      // Tags page
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/tags</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.8</priority>\n";
      sitemap += "  </url>\n";

      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/shorts</loc>\n`;
      sitemap += "    <changefreq>daily</changefreq>\n";
      sitemap += "    <priority>0.8</priority>\n";
      sitemap += "  </url>\n";

      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/about</loc>\n`;
      sitemap += "    <changefreq>monthly</changefreq>\n";
      sitemap += "    <priority>0.4</priority>\n";
      sitemap += "  </url>\n";

      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/donate</loc>\n`;
      sitemap += "    <changefreq>monthly</changefreq>\n";
      sitemap += "    <priority>0.3</priority>\n";
      sitemap += "  </url>\n";

      // Popular page
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/popular</loc>\n`;
      sitemap += "    <changefreq>daily</changefreq>\n";
      sitemap += "    <priority>0.9</priority>\n";
      sitemap += "  </url>\n";

      for (const channel of channels) {
        const slug = `${generateSlug(channel.name, 80)}-${channel.id}`;
        sitemap += "  <url>\n";
        sitemap += `    <loc>${baseUrl}/channels/${slug}</loc>\n`;
        sitemap += "    <changefreq>weekly</changefreq>\n";
        sitemap += "    <priority>0.6</priority>\n";
        sitemap += "  </url>\n";
      }

      // Category filter pages
      for (const category of categories) {
        sitemap += "  <url>\n";
        sitemap += `    <loc>${baseUrl}/categories?filter=${category.id}</loc>\n`;
        sitemap += "    <changefreq>weekly</changefreq>\n";
        sitemap += "    <priority>0.7</priority>\n";
        sitemap += "  </url>\n";
      }

      for (const tag of tags) {
        const tagSlug = encodeURIComponent(String((tag as any).tagName || "").trim().replace(/\s+/g, "-"));
        sitemap += "  <url>\n";
        sitemap += `    <loc>${baseUrl}/tag/${tagSlug}</loc>\n`;
        sitemap += "    <changefreq>weekly</changefreq>\n";
        sitemap += "    <priority>0.5</priority>\n";
        sitemap += "  </url>\n";
      }

      // Individual video pages with video metadata
      for (const video of videos) {
        try {
          sitemap += "  <url>\n";
          sitemap += `    <loc>${baseUrl}/video/${video.slug || video.id}</loc>\n`;
          sitemap += "    <changefreq>monthly</changefreq>\n";
          sitemap += "    <priority>0.6</priority>\n";
          sitemap += "    <video:video>\n";
          sitemap += `      <video:thumbnail_loc>${video.thumbnailUrl}</video:thumbnail_loc>\n`;
          sitemap += `      <video:title>${escapeXml(video.title)}</video:title>\n`;
          if (video.description) {
            sitemap += `      <video:description>${escapeXml(video.description.substring(0, 2048))}</video:description>\n`;
          }
          sitemap += `      <video:content_loc>https://www.youtube.com/watch?v=${video.videoId}</video:content_loc>\n`;
          sitemap += `      <video:player_loc>https://www.youtube.com/embed/${video.videoId}</video:player_loc>\n`;
          // Use createdAt for publication_date in ISO 8601 format
          if (video.createdAt) {
            try {
              const pubDate = new Date(video.createdAt).toISOString();
              sitemap += `      <video:publication_date>${pubDate}</video:publication_date>\n`;
            } catch (dateError) {
              console.error(
                `Error formatting date for video ${video.id}:`,
                dateError,
              );
            }
          }
          sitemap += "    </video:video>\n";
          sitemap += "  </url>\n";
        } catch (videoError) {
          console.error(
            `Error processing video ${video.id} in sitemap:`,
            videoError,
          );
          // Continue with next video
        }
      }

      sitemap += "</urlset>";

      // Cache for 1 hour
      await setCache(cacheKey, sitemap, 3600);

      res.header("Content-Type", "application/xml");
      res.header("X-Cache", "MISS");
      res.send(sitemap);
    } catch (error) {
      console.error("Sitemap generation error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", async (req, res) => {
    // Use the custom domain if available, otherwise fall back to host header
    const baseUrl = "https://nisam.video";

    let robotsTxt = `# Robots.txt for nisam.video
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay (be nice to servers)
Crawl-delay: 1
`;

    if (isDbReady()) {
      try {
        const settings = await db.select().from(seoSettings).limit(1);
        if (settings.length > 0 && settings[0].robotsTxt) {
          robotsTxt = settings[0].robotsTxt;
        }
      } catch (error: any) {
        if (error?.code !== "42P01") {
          console.error("Robots.txt load error:", error);
        }
      }
    }

    res.header("Content-Type", "text/plain");
    res.send(robotsTxt);
  });

  const httpServer = createServer(app);

  return httpServer;
}
