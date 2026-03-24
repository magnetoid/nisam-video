import { Request, Response, NextFunction } from "express";
import fs from "fs";
import { storage } from "./storage/index.js";
import { generateSlug } from "./utils.js";

// Cache template in memory to avoid reading disk on every request
let cachedTemplate: string | null = null;

export async function seoMiddleware(req: Request, res: Response, next: NextFunction, indexPath: string) {
  // Only handle HTML requests for known routes
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.accepts('html')) {
    return next();
  }

  try {
    if (!cachedTemplate) {
      if (!fs.existsSync(indexPath)) {
        return next();
      }
      cachedTemplate = fs.readFileSync(indexPath, "utf-8");
    }

    let template = cachedTemplate;

    // Defaults from settings
    const settings = await storage.getSeoSettings();
    const baseUrl = process.env.PUBLIC_BASE_URL || "https://nisam.video";
    let title = settings?.siteTitle || "nisam.video - AI Curated Videos";
    let description = settings?.siteDescription || "Discover the best videos curated by AI. Automatically categorized and tagged for your viewing pleasure.";
    let image = settings?.ogImage || `${baseUrl}/og-image.jpg`;
    let twitterHandle = settings?.twitterHandle || "@nisamvideo";
    let url = `${baseUrl}${req.path}`;
    let type = "website";
    let structuredData = "";
    let canonicalUrl = url;

    // ── Video Pages: /video/:slug ──────────────────────────────────────────
    const videoMatch = req.path.match(/^\/video\/([^\/]+)$/);
    if (videoMatch) {
      const slugOrId = videoMatch[1];
      const video = await storage.getVideoBySlug(slugOrId) || await storage.getVideo(slugOrId);

      if (video) {
        title = `${video.title} | nisam.video`;
        const rawDesc = video.description || "";
        description = rawDesc.replace(/<[^>]*>?/gm, '').substring(0, 160).trim();
        if (rawDesc.length > 160) description += "...";

        image = video.thumbnailUrl || image;
        type = "video.other";
        canonicalUrl = `${baseUrl}/video/${video.slug || video.id}`;

        const videoObject: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "name": video.title,
          "description": video.description || "",
          "thumbnailUrl": [video.thumbnailUrl],
          "uploadDate": video.publishDate ? new Date(video.publishDate).toISOString() : new Date(video.createdAt).toISOString(),
          "contentUrl": `https://www.youtube.com/watch?v=${video.videoId}`,
          "embedUrl": `https://www.youtube.com/embed/${video.videoId}`,
        };

        if (video.duration) {
          videoObject["duration"] = video.duration;
        }

        structuredData = JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            videoObject,
            {
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl },
                { "@type": "ListItem", "position": 2, "name": video.title, "item": canonicalUrl },
              ],
            },
          ],
        });
      }
    }

    // ── Category Pages: /category/:slug ───────────────────────────────────
    const categoryMatch = req.path.match(/^\/category\/([^\/]+)$/);
    if (categoryMatch) {
      const slug = categoryMatch[1];
      try {
        const category = await storage.getCategoryBySlug?.(slug) || await storage.getCategory?.(slug);
        if (category) {
          title = `${category.name} Videos | nisam.video`;
          description = category.description || `Browse the best ${category.name} videos on nisam.video. AI-curated content organized by category.`;
          canonicalUrl = `${baseUrl}/category/${slug}`;
          structuredData = JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "CollectionPage",
                "name": category.name,
                "description": description,
                "url": canonicalUrl,
              },
              {
                "@type": "BreadcrumbList",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl },
                  { "@type": "ListItem", "position": 2, "name": "Categories", "item": `${baseUrl}/categories` },
                  { "@type": "ListItem", "position": 3, "name": category.name, "item": canonicalUrl },
                ],
              },
            ],
          });
        }
      } catch {
        // category not found — use defaults
      }
    }

    // ── Channel Pages: /channels/:slug ────────────────────────────────────
    const channelMatch = req.path.match(/^\/channels\/([^\/]+)$/);
    if (channelMatch) {
      const slugOrId = channelMatch[1];
      // Extract UUID from end of slug
      const uuidMatch = slugOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      const channelId = uuidMatch?.[0] || slugOrId;
      try {
        const channel = await storage.getChannel?.(channelId);
        if (channel) {
          title = `${channel.name} | nisam.video`;
          description = (channel as any).description || `Watch all videos from ${channel.name} on nisam.video. AI-curated video content from this channel.`;
          image = channel.thumbnailUrl || channel.bannerUrl || image;
          const canonicalSlug = `${generateSlug(channel.name, 80)}-${channel.id}`;
          canonicalUrl = `${baseUrl}/channels/${canonicalSlug}`;
          structuredData = JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "ProfilePage",
                "name": channel.name,
                "description": description,
                "url": canonicalUrl,
                "image": image,
              },
              {
                "@type": "BreadcrumbList",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl },
                  { "@type": "ListItem", "position": 2, "name": "Channels", "item": `${baseUrl}/channels` },
                  { "@type": "ListItem", "position": 3, "name": channel.name, "item": canonicalUrl },
                ],
              },
            ],
          });
        }
      } catch {
        // channel not found — use defaults
      }
    }

    // ── Static pages ──────────────────────────────────────────────────────
    if (req.path === "/popular") {
      title = "Popular Videos | nisam.video";
      description = "Watch the most popular and trending videos on nisam.video. Discover what's hot across all categories sorted by view count.";
      canonicalUrl = `${baseUrl}/popular`;
      structuredData = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Popular Videos",
        "description": description,
        "url": canonicalUrl,
      });
    }

    if (req.path === "/tags") {
      title = "Browse by Tags | nisam.video";
      description = "Discover videos through AI-generated tags on nisam.video. Find content by specific topics, keywords, and themes.";
      canonicalUrl = `${baseUrl}/tags`;
    }

    if (req.path === "/categories") {
      title = "Video Categories | nisam.video";
      description = "Browse all video categories on nisam.video. Find AI-curated content organized by topic, genre, and theme.";
      canonicalUrl = `${baseUrl}/categories`;
    }

    if (req.path === "/channels") {
      title = "Video Channels | nisam.video";
      description = "Browse all YouTube and TikTok channels on nisam.video. Discover quality content creators curated by AI.";
      canonicalUrl = `${baseUrl}/channels`;
    }

    if (req.path === "/about") {
      title = "About nisam.video - AI-Powered Video Hub";
      description = "nisam.video is an AI-powered video aggregation platform that discovers and curates the best YouTube and TikTok content — automatically categorized, tagged, and organized for you.";
      canonicalUrl = `${baseUrl}/about`;
    }

    if (req.path === "/shorts") {
      title = "Short Videos | nisam.video";
      description = "Watch the best short-form videos on nisam.video. AI-curated quick content from YouTube Shorts and TikTok.";
      canonicalUrl = `${baseUrl}/shorts`;
    }

    // ── Build meta tag HTML ────────────────────────────────────────────────
    const e = (val: string) => val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const metaTags = `
      <title>${e(title)}</title>
      <meta name="description" content="${e(description)}">
      <link rel="canonical" href="${e(canonicalUrl)}">

      <!-- Open Graph -->
      <meta property="og:title" content="${e(title)}">
      <meta property="og:description" content="${e(description)}">
      <meta property="og:image" content="${e(image)}">
      <meta property="og:image:width" content="1280">
      <meta property="og:image:height" content="720">
      <meta property="og:image:alt" content="${e(title)}">
      <meta property="og:url" content="${e(canonicalUrl)}">
      <meta property="og:type" content="${e(type)}">
      <meta property="og:site_name" content="nisam.video">
      <meta property="og:locale" content="en_US">

      <!-- Twitter -->
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:site" content="${e(twitterHandle)}">
      <meta name="twitter:title" content="${e(title)}">
      <meta name="twitter:description" content="${e(description)}">
      <meta name="twitter:image" content="${e(image)}">
      <meta name="twitter:image:alt" content="${e(title)}">

      ${structuredData ? `<script type="application/ld+json">${structuredData}</script>` : ''}
    `;

    // Remove existing <title> and <meta name="description"> to avoid duplicates
    let html = template
      .replace(/<title>.*?<\/title>/is, "")
      .replace(/<meta\s+name=["']description["']\s+content=["'].*?["']\s*\/?>/is, "");

    // Inject new tags before </head>
    html = html.replace(/<\/head>/i, `${metaTags}</head>`);

    res.send(html);
  } catch (error) {
    console.error("SEO Middleware Error:", error);
    // Fallback to sending the file directly if injection fails
    res.sendFile(indexPath);
  }
}
