import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage/index.js";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage/index.js";
import { registerFeatureRoutes } from "./routes/index.js";
import { db, isDbReady } from "./db.js";
import { seoSettings, videos as videosTable } from "../shared/schema.js";
import { generateSlug } from "./utils.js";
import { getCache, setCache } from "./services/redis.js";
import imageRouter from "./routes/images.js";
import { sql } from "drizzle-orm";

import languageRoutes from "./routes/languages.js";
import { getIndexNowKey } from "./services/indexnow.js";

function parseDurationToSitemapSeconds(dur: string): number | undefined {
  // ISO 8601: PT1H2M30S, PT5M, PT30S
  const isoMatch = dur.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (isoMatch) {
    return (parseInt(isoMatch[1] || "0") * 3600) + (parseInt(isoMatch[2] || "0") * 60) + parseInt(isoMatch[3] || "0");
  }
  // HH:MM:SS or MM:SS
  const parts = dur.split(":").map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every(n => !isNaN(n))) return parts[0] * 60 + parts[1];
  return undefined;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Image proxy
  app.use("/api/images", imageRouter);

  // Register object storage routes
  registerObjectStorageRoutes(app);
  
  // Register modular feature routes (auth, channels, tiktok, videos, etc.)
  registerFeatureRoutes(app);
  
  // Register language routes
  app.use("/api", languageRoutes);

  // SEO Routes - Sitemap and Robots
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
      const proto = forwardedProto || req.protocol;
      const host = req.get("host") || "nisam.video";
      const baseUrl = process.env.PUBLIC_BASE_URL || `${proto}://${host}`;

      const lang = typeof (req.query as any)?.lang === "string" ? String((req.query as any).lang) : "en";
      const maxVideosRaw = typeof (req.query as any)?.maxVideos === "string" ? String((req.query as any).maxVideos) : undefined;
      // Default to 50000 if not specified
      const maxVideos = maxVideosRaw && Number.isFinite(parseInt(maxVideosRaw, 10)) 
        ? Math.max(0, parseInt(maxVideosRaw, 10)) 
        : 50000;

      const includeVideos = String((req.query as any)?.includeVideos ?? "1") !== "0";

      const includeCategories = String((req.query as any)?.includeCategories ?? "1") !== "0";
      const includeTags = String((req.query as any)?.includeTags ?? "1") !== "0";
      const includeChannels = String((req.query as any)?.includeChannels ?? "1") !== "0";

      const pageSize = 300;

      const escapeXml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const withParams = (loc: string) => {
        const params = new URLSearchParams();
        if (lang !== "en") params.set("lang", lang);
        if (maxVideos !== 50000) params.set("maxVideos", String(maxVideos));
        if (!includeVideos) params.set("includeVideos", "0");
        if (!includeCategories) params.set("includeCategories", "0");
        if (!includeTags) params.set("includeTags", "0");
        if (!includeChannels) params.set("includeChannels", "0");
        const qs = params.toString();
        return qs ? `${loc}?${qs}` : loc;
      };

      // Try Redis Cache
      const cacheKey = `sitemap:index:${lang}:${maxVideos}:${includeVideos ? 1 : 0}:${includeCategories ? 1 : 0}:${includeTags ? 1 : 0}:${includeChannels ? 1 : 0}`;
      try {
        const cachedSitemap = await getCache<string>(cacheKey);
        if (cachedSitemap) {
          res.header("Content-Type", "application/xml");
          res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
          res.header("X-Cache", "HIT-REDIS");
          return res.send(cachedSitemap);
        }
      } catch (err) {
        console.error("Redis cache error:", err);
      }

      const [channels, categories, tags, videoCountRow] = await Promise.all([
        includeChannels ? storage.getAllChannels() : Promise.resolve([]),
        includeCategories ? storage.getAllLocalizedCategories(lang) : Promise.resolve([]),
        includeTags ? storage.getAllLocalizedTags(lang) : Promise.resolve([]),
        includeVideos && maxVideos !== 0
          ? db.select({ count: sql<number>`count(*)` }).from(videosTable)
          : Promise.resolve([{ count: 0 }]),
      ]);

      const totalVideos = Math.min(maxVideos, Number(videoCountRow?.[0]?.count || 0));
      const pages = {
        static: 1,
        channels: Math.max(1, Math.ceil(channels.length / pageSize)),
        categories: Math.max(1, Math.ceil(categories.length / pageSize)),
        tags: Math.max(1, Math.ceil(tags.length / pageSize)),
        videos: Math.max(1, Math.ceil(totalVideos / pageSize)),
      };

      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      const addSitemapLoc = (loc: string) => {
        sitemap += "  <sitemap>\n";
        sitemap += `    <loc>${escapeXml(withParams(loc))}</loc>\n`;
        sitemap += "  </sitemap>\n";
      };

      addSitemapLoc(`${baseUrl}/sitemaps/static-1.xml`);
      if (includeChannels) {
        for (let p = 1; p <= pages.channels; p++) addSitemapLoc(`${baseUrl}/sitemaps/channels-${p}.xml`);
      }
      if (includeCategories) {
        for (let p = 1; p <= pages.categories; p++) addSitemapLoc(`${baseUrl}/sitemaps/categories-${p}.xml`);
      }
      if (includeTags) {
        for (let p = 1; p <= pages.tags; p++) addSitemapLoc(`${baseUrl}/sitemaps/tags-${p}.xml`);
      }
      if (includeVideos && maxVideos !== 0) {
        for (let p = 1; p <= pages.videos; p++) addSitemapLoc(`${baseUrl}/sitemaps/videos-${p}.xml`);
      }

      sitemap += "</sitemapindex>";

      // Cache for 1 hour
      await setCache(cacheKey, sitemap, 3600);

      res.header("Content-Type", "application/xml");
      res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.header("X-Cache", "MISS");
      res.send(sitemap);
    } catch (error) {
      console.error("Sitemap generation error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/sitemaps/:name.xml", async (req, res) => {
    try {
      const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
      const proto = forwardedProto || req.protocol;
      const host = req.get("host") || "nisam.video";
      const baseUrl = process.env.PUBLIC_BASE_URL || `${proto}://${host}`;

      const lang = typeof (req.query as any)?.lang === "string" ? String((req.query as any).lang) : "en";
      const maxVideosRaw = typeof (req.query as any)?.maxVideos === "string" ? String((req.query as any).maxVideos) : undefined;
      const maxVideos = maxVideosRaw && Number.isFinite(parseInt(maxVideosRaw, 10)) 
        ? Math.max(0, parseInt(maxVideosRaw, 10)) 
        : 50000;

      const includeVideos = String((req.query as any)?.includeVideos ?? "1") !== "0";
      const includeCategories = String((req.query as any)?.includeCategories ?? "1") !== "0";
      const includeTags = String((req.query as any)?.includeTags ?? "1") !== "0";
      const includeChannels = String((req.query as any)?.includeChannels ?? "1") !== "0";

      const pageSize = 300;

      const escapeXml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const name = String(req.params.name || "");
      const match = name.match(/^(static|channels|categories|tags|videos)-(\d+)$/);
      if (!match) return res.status(404).send("Not found");
      const type = match[1];
      const page = Math.max(1, parseInt(match[2], 10) || 1);
      const offset = (page - 1) * pageSize;

      const cacheKey = `sitemap:page:${type}:${page}:${lang}:${maxVideos}:${includeVideos ? 1 : 0}:${includeCategories ? 1 : 0}:${includeTags ? 1 : 0}:${includeChannels ? 1 : 0}`;
      try {
        const cached = await getCache<string>(cacheKey);
        if (cached) {
          res.header("Content-Type", "application/xml");
          res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
          res.header("X-Cache", "HIT-REDIS");
          return res.send(cached);
        }
      } catch {
      }

      const langs = (await storage.getSupportedLanguages().catch(() => []))
        .map((l: any) => String(l?.code || "").trim())
        .filter(Boolean);

      const buildAlternates = (loc: string): string => {
        if (langs.length < 2) return "";
        const url = new URL(loc);
        let out = "";
        for (const code of langs) {
          const u = new URL(url.toString());
          u.searchParams.set("lang", code);
          out += `    <xhtml:link rel="alternate" hreflang="${escapeXml(code)}" href="${escapeXml(u.toString())}" />\n`;
        }
        const xDefault = new URL(url.toString());
        xDefault.searchParams.delete("lang");
        out += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefault.toString())}" />\n`;
        return out;
      };

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

      const addUrl = (loc: string, opts?: { changefreq?: string; priority?: string; lastmod?: string; video?: any; images?: { loc: string; title?: string; caption?: string }[] }) => {
        xml += "  <url>\n";
        xml += `    <loc>${escapeXml(loc)}</loc>\n`;
        xml += buildAlternates(loc);
        if (opts?.lastmod) xml += `    <lastmod>${opts.lastmod}</lastmod>\n`;
        if (opts?.changefreq) xml += `    <changefreq>${opts.changefreq}</changefreq>\n`;
        if (opts?.priority) xml += `    <priority>${opts.priority}</priority>\n`;
        if (opts?.images) {
          for (const img of opts.images) {
            if (!img.loc) continue;
            xml += "    <image:image>\n";
            xml += `      <image:loc>${escapeXml(img.loc)}</image:loc>\n`;
            if (img.title) xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`;
            if (img.caption) xml += `      <image:caption>${escapeXml(img.caption.substring(0, 500))}</image:caption>\n`;
            xml += "    </image:image>\n";
          }
        }
        if (opts?.video) {
          const v = opts.video;
          xml += "    <video:video>\n";
          xml += `      <video:thumbnail_loc>${escapeXml(String(v.thumbnailUrl || ""))}</video:thumbnail_loc>\n`;
          xml += `      <video:title>${escapeXml(String(v.title || ""))}</video:title>\n`;
          if (v.description) {
            xml += `      <video:description>${escapeXml(String(v.description).substring(0, 2048))}</video:description>\n`;
          }
          xml += `      <video:content_loc>${escapeXml(String(v.contentLoc || ""))}</video:content_loc>\n`;
          xml += `      <video:player_loc>${escapeXml(String(v.playerLoc || ""))}</video:player_loc>\n`;
          if (v.publicationDate) xml += `      <video:publication_date>${escapeXml(String(v.publicationDate))}</video:publication_date>\n`;
          if (v.duration) xml += `      <video:duration>${escapeXml(String(v.duration))}</video:duration>\n`;
          if (v.viewCount) xml += `      <video:view_count>${escapeXml(String(v.viewCount))}</video:view_count>\n`;
          if (v.uploader) xml += `      <video:uploader>${escapeXml(String(v.uploader))}</video:uploader>\n`;
          xml += "      <video:family_friendly>yes</video:family_friendly>\n";
          xml += "    </video:video>\n";
        }
        xml += "  </url>\n";
      };

      if (type === "static") {
        if (page !== 1) {
          xml += "</urlset>";
          res.header("Content-Type", "application/xml");
          return res.send(xml);
        }
        const today = new Date().toISOString().split("T")[0];
        addUrl(`${baseUrl}/`, { changefreq: "daily", priority: "1.0", lastmod: today });
        addUrl(`${baseUrl}/channels`, { changefreq: "weekly", priority: "0.7", lastmod: today });
        addUrl(`${baseUrl}/categories`, { changefreq: "weekly", priority: "0.8", lastmod: today });
        addUrl(`${baseUrl}/tags`, { changefreq: "weekly", priority: "0.8", lastmod: today });
        addUrl(`${baseUrl}/shorts`, { changefreq: "daily", priority: "0.8", lastmod: today });
        addUrl(`${baseUrl}/about`, { changefreq: "monthly", priority: "0.4" });
        addUrl(`${baseUrl}/donate`, { changefreq: "monthly", priority: "0.3" });
        addUrl(`${baseUrl}/faq`, { changefreq: "monthly", priority: "0.5" });
        addUrl(`${baseUrl}/privacy`, { changefreq: "yearly", priority: "0.2" });
        addUrl(`${baseUrl}/terms`, { changefreq: "yearly", priority: "0.2" });
        addUrl(`${baseUrl}/popular`, { changefreq: "daily", priority: "0.9", lastmod: today });
      }

      if (type === "channels" && includeChannels) {
        const all = await storage.getAllChannels();
        const slice = all.slice(offset, offset + pageSize);
        for (const channel of slice) {
          const slug = `${generateSlug(channel.name, 80)}-${channel.id}`;
          const lastmod = (channel as any).updatedAt
            ? new Date((channel as any).updatedAt).toISOString().split("T")[0]
            : undefined;
          addUrl(`${baseUrl}/channels/${slug}`, { changefreq: "weekly", priority: "0.6", lastmod });
        }
      }

      if (type === "categories" && includeCategories) {
        const all = await storage.getAllLocalizedCategories(lang);
        const slice = all.slice(offset, offset + pageSize);
        for (const category of slice) {
          // Use slug-based URLs for proper SEO; fall back to id-based slug
          const catSlug = category.slug || generateSlug(category.name || String(category.id), 80);
          const lastmod = (category as any).updatedAt
            ? new Date((category as any).updatedAt).toISOString().split("T")[0]
            : undefined;
          addUrl(`${baseUrl}/category/${catSlug}`, { changefreq: "weekly", priority: "0.7", lastmod });
        }
      }

      if (type === "tags" && includeTags) {
        const all = await storage.getAllLocalizedTags(lang);
        const slice = all.slice(offset, offset + pageSize);
        for (const tag of slice) {
          const tagSlug = encodeURIComponent(String(tag.tagName || "").trim().replace(/\s+/g, "-"));
          addUrl(`${baseUrl}/tag/${tagSlug}`, { changefreq: "weekly", priority: "0.5" });
        }
      }

      if (type === "videos" && includeVideos && maxVideos !== 0) {
        const cappedOffset = Math.min(offset, maxVideos);
        const cappedLimit = Math.max(0, Math.min(pageSize, maxVideos - cappedOffset));
        if (cappedLimit > 0) {
          const vids = await storage.getAllVideos({
            lang,
            limit: cappedLimit,
            offset: cappedOffset,
            sort: "createdAt",
          });

          for (const video of vids) {
            const publicationDate = video.createdAt ? new Date(video.createdAt).toISOString() : undefined;
            const lastmod = (video as any).updatedAt
              ? new Date((video as any).updatedAt).toISOString().split("T")[0]
              : publicationDate?.split("T")[0];
            const images = video.thumbnailUrl
              ? [{ loc: video.thumbnailUrl, title: video.title || undefined, caption: video.description || undefined }]
              : undefined;
            addUrl(`${baseUrl}/video/${video.slug || video.id}`, {
              changefreq: "monthly",
              priority: "0.6",
              lastmod,
              images,
              video: {
                thumbnailUrl: video.thumbnailUrl,
                title: video.title,
                description: video.description,
                contentLoc: `https://www.youtube.com/watch?v=${video.videoId}`,
                playerLoc: `https://www.youtube.com/embed/${video.videoId}`,
                publicationDate,
                duration: video.duration ? parseDurationToSitemapSeconds(video.duration) : undefined,
                viewCount: video.viewCount ? parseInt(String(video.viewCount).replace(/[,\s]/g, "").match(/\d+/)?.[0] || "0") || undefined : undefined,
                uploader: (video as any).channel?.name,
              },
            });
          }
        }
      }

      xml += "</urlset>";
      await setCache(cacheKey, xml, 3600);
      res.header("Content-Type", "application/xml");
      res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.header("X-Cache", "MISS");
      res.send(xml);
    } catch (error) {
      console.error("Sitemap page generation error:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // IndexNow key verification file
  app.get(`/${getIndexNowKey()}.txt`, (_req, res) => {
    res.type("text/plain").send(getIndexNowKey());
  });

  app.get("/robots.txt", async (req, res) => {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const proto = forwardedProto || req.protocol;
    const host = req.get("host") || "";
    const baseUrl = process.env.PUBLIC_BASE_URL || (host ? `${proto}://${host}` : "");

    let siteName = "";
    let dbRobots: string | null = null;
    if (isDbReady()) {
      try {
        const settings = await db.select().from(seoSettings).limit(1);
        if (settings.length > 0) {
          siteName = settings[0].siteName || "";
          if (settings[0].robotsTxt) dbRobots = settings[0].robotsTxt;
        }
      } catch (error: any) {
        if (error?.code !== "42P01") {
          console.error("Robots.txt load error:", error);
        }
      }
    }

    const robotsTxt = dbRobots || `# Robots.txt${siteName ? ` for ${siteName}` : ""}
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

${baseUrl ? `Sitemap: ${baseUrl}/sitemap.xml\n` : ""}
# Crawl delay (be nice to servers)
Crawl-delay: 1
`;

    res.header("Content-Type", "text/plain");
    res.header("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(robotsTxt);
  });

  // llms.txt — markdown index for AI/LLM crawlers (Claude, Perplexity, ChatGPT, etc.)
  // Per the seo-llm-context skill: clean markdown summarizing site structure and key pages
  app.get("/llms.txt", async (req, res) => {
    try {
      const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
      const proto = forwardedProto || req.protocol;
      const host = req.get("host") || "";
      const baseUrl = process.env.PUBLIC_BASE_URL || (host ? `${proto}://${host}` : "");

      const cacheKey = `llms-txt:${baseUrl}`;
      const cached = await getCache<string>(cacheKey).catch(() => null);
      if (cached) {
        res.header("Content-Type", "text/markdown; charset=utf-8");
        res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
        res.header("X-Cache", "HIT");
        return res.send(cached);
      }

      let siteName = "";
      let siteDescription = "";
      if (isDbReady()) {
        try {
          const settings = await db.select().from(seoSettings).limit(1);
          if (settings.length > 0) {
            siteName = settings[0].siteName || "";
            siteDescription = settings[0].siteDescription || "";
          }
        } catch {}
      }

      let md = `# ${siteName || host || "Site"}\n\n`;
      if (siteDescription) md += `> ${siteDescription}\n\n`;

      md += `## Main Pages\n`;
      md += `- [Home](${baseUrl}/) — Homepage with curated video carousels\n`;
      md += `- [Categories](${baseUrl}/categories) — Browse videos by AI-generated category\n`;
      md += `- [Tags](${baseUrl}/tags) — Browse videos by tag\n`;
      md += `- [Channels](${baseUrl}/channels) — Browse content sources\n`;
      md += `- [About](${baseUrl}/about) — About the platform\n`;
      md += `- [FAQ](${baseUrl}/faq) — Frequently asked questions\n\n`;

      try {
        const cats = await storage.getAllLocalizedCategories("en").catch(() => []);
        const topCats = (cats || []).slice(0, 30);
        if (topCats.length > 0) {
          md += `## Categories\n`;
          for (const c of topCats) {
            const slug = (c as any).slug || generateSlug(c.name || String(c.id), 80);
            md += `- [${c.name || slug}](${baseUrl}/category/${slug})\n`;
          }
          md += `\n`;
        }

        const channels = await storage.getAllChannels().catch(() => []);
        const topChannels = (channels || []).slice(0, 30);
        if (topChannels.length > 0) {
          md += `## Channels\n`;
          for (const ch of topChannels) {
            const slug = `${generateSlug(ch.name, 80)}-${ch.id}`;
            md += `- [${ch.name}](${baseUrl}/channels/${slug})\n`;
          }
          md += `\n`;
        }

        const recentVideos = await storage.getAllVideos({ lang: "en", limit: 50, offset: 0, sort: "createdAt" }).catch(() => []);
        if (recentVideos.length > 0) {
          md += `## Recent Videos\n`;
          for (const v of recentVideos) {
            md += `- [${v.title}](${baseUrl}/video/${v.slug || v.id})\n`;
          }
          md += `\n`;
        }
      } catch (e) {
        console.warn("[llms.txt] failed to enumerate content:", e);
      }

      md += `## Crawler Notes\n`;
      md += `- This file is intended for AI crawlers (Claude, Perplexity, ChatGPT, Google AI Overviews).\n`;
      md += `- Sitemap: ${baseUrl}/sitemap.xml\n`;
      md += `- Robots: ${baseUrl}/robots.txt\n`;

      await setCache(cacheKey, md, 3600).catch(() => undefined);
      res.header("Content-Type", "text/markdown; charset=utf-8");
      res.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.header("X-Cache", "MISS");
      res.send(md);
    } catch (error) {
      console.error("llms.txt error:", error);
      res.status(500).type("text/plain").send("# Error generating llms.txt\n");
    }
  });

  // security.txt — RFC 9116 standard location for security disclosure contact
  const securityTxtHandler = async (req: any, res: any) => {
    let contactEmail = "";
    let siteName = "";
    if (isDbReady()) {
      try {
        const settings = await db.select().from(seoSettings).limit(1);
        if (settings.length > 0) {
          contactEmail = (settings[0] as any).businessEmail || "";
          siteName = settings[0].siteName || "";
        }
      } catch {}
    }

    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const proto = forwardedProto || req.protocol;
    const host = req.get("host") || "";
    const baseUrl = process.env.PUBLIC_BASE_URL || (host ? `${proto}://${host}` : "");

    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const lines: string[] = [];
    if (contactEmail) lines.push(`Contact: mailto:${contactEmail}`);
    lines.push(`Expires: ${expires}`);
    lines.push(`Preferred-Languages: en`);
    if (baseUrl) lines.push(`Canonical: ${baseUrl}/.well-known/security.txt`);
    if (siteName) lines.push(`# Security disclosures for ${siteName}`);

    res.header("Content-Type", "text/plain; charset=utf-8");
    res.header("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(lines.join("\n") + "\n");
  };
  app.get("/.well-known/security.txt", securityTxtHandler);
  app.get("/security.txt", securityTxtHandler);

  app.get("/manifest.json", async (req, res) => {
    try {
      let settings = {
        pwaName: "nisam.video - AI Video Hub",
        pwaShortName: "nisam.video",
        pwaDescription: "AI-powered YouTube video aggregation hub with curated content",
        pwaThemeColor: "#E50914",
        pwaBackgroundColor: "#141414",
        pwaIcon192: "/icon-192.png",
        pwaIcon512: "/icon-512.png",
      };

      if (isDbReady()) {
        const dbSettings = await storage.getSystemSettings();
        if (dbSettings) {
          settings = {
            pwaName: dbSettings.pwaName || settings.pwaName,
            pwaShortName: dbSettings.pwaShortName || settings.pwaShortName,
            pwaDescription: dbSettings.pwaDescription || settings.pwaDescription,
            pwaThemeColor: dbSettings.pwaThemeColor || settings.pwaThemeColor,
            pwaBackgroundColor: dbSettings.pwaBackgroundColor || settings.pwaBackgroundColor,
            pwaIcon192: dbSettings.pwaIcon192 || settings.pwaIcon192,
            pwaIcon512: dbSettings.pwaIcon512 || settings.pwaIcon512,
          };
        }
      }

      const manifest = {
        name: settings.pwaName,
        short_name: settings.pwaShortName,
        description: settings.pwaDescription,
        start_url: "/",
        display: "standalone",
        background_color: settings.pwaBackgroundColor,
        theme_color: settings.pwaThemeColor,
        orientation: "any",
        icons: [
          {
            src: settings.pwaIcon192,
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: settings.pwaIcon512,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        categories: ["entertainment", "video", "multimedia"],
        screenshots: []
      };

      res.header("Content-Type", "application/manifest+json");
      res.send(JSON.stringify(manifest, null, 2));
    } catch (error) {
      console.error("Manifest generation error:", error);
      res.status(500).send("Error generating manifest");
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
