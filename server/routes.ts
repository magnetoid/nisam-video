import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage/index.js";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage/index.js";
import { registerFeatureRoutes } from "./routes/index.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register object storage routes
  registerObjectStorageRoutes(app);
  
  // Register modular feature routes (auth, channels, tiktok, videos, etc.)
  registerFeatureRoutes(app);

  // SEO Routes - Sitemap and Robots
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const videos = await storage.getAllVideos();
      const categories = await storage.getAllLocalizedCategories('en');
      const baseUrl = "https://nisam.video";

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

      // Popular page
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/popular</loc>\n`;
      sitemap += "    <changefreq>daily</changefreq>\n";
      sitemap += "    <priority>0.9</priority>\n";
      sitemap += "  </url>\n";

      // Category filter pages
      for (const category of categories) {
        sitemap += "  <url>\n";
        sitemap += `    <loc>${baseUrl}/categories?filter=${category.id}</loc>\n`;
        sitemap += "    <changefreq>weekly</changefreq>\n";
        sitemap += "    <priority>0.7</priority>\n";
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
          sitemap += `      <video:title>${video.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</video:title>\n`;
          if (video.description) {
            const cleanDesc = video.description
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            sitemap += `      <video:description>${cleanDesc.substring(0, 2048)}</video:description>\n`;
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

      res.header("Content-Type", "application/xml");
      res.send(sitemap);
    } catch (error) {
      console.error("Sitemap generation error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", async (req, res) => {
    // Use the custom domain if available, otherwise fall back to host header
    const baseUrl = "https://nisam.video";

    const robotsTxt = `# Robots.txt for nisam.video
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay (be nice to servers)
Crawl-delay: 1
`;

    res.header("Content-Type", "text/plain");
    res.send(robotsTxt);
  });

  const httpServer = createServer(app);

  return httpServer;
}
