import { Request, Response, NextFunction } from "express";
import fs from "fs";
import { storage } from "./storage/index.js";

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
    
    // Defaults
    const settings = await storage.getSeoSettings();
    let title = settings?.siteTitle || "nisam.video - AI Curated Videos";
    let description = settings?.siteDescription || "Discover the best videos curated by AI. Automatically categorized and tagged for your viewing pleasure.";
    let image = settings?.ogImage || "https://nisam.video/og-image.jpg"; 
    let twitterHandle = settings?.twitterHandle || "@nisamvideo";
    let url = `https://nisam.video${req.path}`;
    let type = "website";
    let structuredData = "";

    // Handle Video Pages: /video/:slug
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
        
        structuredData = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "VideoObject",
          "name": video.title,
          "description": video.description || "",
          "thumbnailUrl": [video.thumbnailUrl],
          "uploadDate": video.publishDate ? new Date(video.publishDate).toISOString() : new Date(video.createdAt).toISOString(),
          "contentUrl": `https://www.youtube.com/watch?v=${video.videoId}`,
          "embedUrl": `https://www.youtube.com/embed/${video.videoId}`
        });
      }
    }

    // Inject meta tags
    const metaTags = `
      <title>${title.replace(/</g, '&lt;')}</title>
      <meta name="description" content="${description.replace(/"/g, '&quot;')}">
      
      <!-- Open Graph -->
      <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
      <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
      <meta property="og:image" content="${image}">
      <meta property="og:url" content="${url}">
      <meta property="og:type" content="${type}">
      <meta property="og:site_name" content="nisam.video">
      
      <!-- Twitter -->
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:site" content="${twitterHandle}">
      <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
      <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">
      <meta name="twitter:image" content="${image}">
      
      ${structuredData ? `<script type="application/ld+json">${structuredData}</script>` : ''}
    `;

    // 1. Remove existing <title> and <meta name="description"> to avoid duplicates
    let html = template
      .replace(/<title>.*?<\/title>/is, "")
      .replace(/<meta\s+name=["']description["']\s+content=["'].*?["']\s*\/?>/is, "");
    
    // 2. Inject new tags before </head>
    html = html.replace(/<\/head>/i, `${metaTags}</head>`);

    res.send(html);
  } catch (error) {
    console.error("SEO Middleware Error:", error);
    // Fallback to sending the file directly if injection fails
    res.sendFile(indexPath);
  }
}
