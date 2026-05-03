import { Router } from "express";
import { storage } from "../storage/index.js";
import { cache } from "../cache.js";
import { db } from "../db.js";
import {
  videos,
  channels,
  seoSettings,
  categoryTranslations,
  tagTranslations,
} from "../../shared/schema.js";
import { eq } from "drizzle-orm";

function slugifyChannel(name: string, id: string): string {
  const base = (name || "")
    .toLowerCase()
    .trim()
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/đ/g, "dj")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base ? `${base}-${id}` : id;
}

const router = Router();

import { getCache, setCache } from "../services/redis.js";

export const robotsHandler = async (_req: any, res: any) => {
  try {
    const settings = await db.select().from(seoSettings).limit(1);
    const customRobots = settings[0]?.robotsTxt;
    
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=3600");
    
    if (customRobots && customRobots.trim().length > 0) {
      return res.send(customRobots);
    }
    
    const defaultRobots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/admin/

Sitemap: ${process.env.APP_URL || "https://nisam.video"}/sitemap.xml
`;
    res.send(defaultRobots);
  } catch (error) {
    console.error("Error serving robots.txt:", error);
    res.status(500).send("User-agent: *\nAllow: /");
  }
};

export const sitemapHandler = async (_req: any, res: any) => {
  try {
    const cacheKey = "sitemap:xml:main";
    const cachedXml = await getCache<string>(cacheKey);
    if (cachedXml) {
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(cachedXml);
    }

    const baseUrl = process.env.APP_URL || "https://nisam.video";
    
    const defaultLang = "en";
    // Fetch all public URLs. Categories and tags get their slugs from
    // translations; channels build a slug from name+id the same way the client does.
    const [allVideos, allCategories, allChannels, allTags] = await Promise.all([
      db.select({ slug: videos.slug, createdAt: videos.createdAt }).from(videos),
      db
        .select({ slug: categoryTranslations.slug })
        .from(categoryTranslations)
        .where(eq(categoryTranslations.languageCode, defaultLang)),
      db.select({ id: channels.id, name: channels.name }).from(channels),
      db
        .select({ tagName: tagTranslations.tagName })
        .from(tagTranslations)
        .where(eq(tagTranslations.languageCode, defaultLang)),
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Add homepage
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    // Add videos
    for (const v of allVideos) {
      if (!v.slug) continue;
      const date = v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      xml += `  <url>\n    <loc>${baseUrl}/video/${v.slug}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // Add categories
    for (const c of allCategories) {
      if (!c.slug) continue;
      xml += `  <url>\n    <loc>${baseUrl}/category/${c.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    // Add channels
    for (const ch of allChannels) {
      const slug = slugifyChannel(ch.name, ch.id);
      xml += `  <url>\n    <loc>${baseUrl}/channels/${slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    }

    // Add tags
    const seenTagSlugs = new Set<string>();
    for (const t of allTags) {
      const slug = encodeURIComponent((t.tagName || "").trim().replace(/\s+/g, "-"));
      if (!slug || seenTagSlugs.has(slug)) continue;
      seenTagSlugs.add(slug);
      xml += `  <url>\n    <loc>${baseUrl}/tag/${slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    await setCache(cacheKey, xml, 3600);

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    res.send(xml);
  } catch (error) {
    console.error("Error serving sitemap.xml:", error);
    res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
  }
};

// Public Hero Config
router.get("/hero/config", async (_req, res) => {
  try {
    const settings = await storage.getHeroSettings();
    res.setHeader("Cache-Control", "public, max-age=300"); // Cache for 5 minutes
    res.json(settings || { 
      fallbackImages: [], 
      rotationInterval: 4000, 
      animationType: 'fade', 
      defaultPlaceholderUrl: '', 
      enableRandom: true, 
      enableImages: true,
      homeHeroMode: 'primary',
      popularPageMode: 'views',
      popularSegments: [],
      showRecent: true,
      showTrending: true,
      showPopular: true
    });
  } catch (error) {
    console.error("Error fetching hero config:", error);
    res.status(500).json({ error: "Failed to fetch hero config" });
  }
});

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
