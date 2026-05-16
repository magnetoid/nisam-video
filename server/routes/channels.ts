import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage.js";
import { scrapeYouTubeChannel, scrapeYouTubeChannelAbout } from "../youtube-scraper.js";
import { categorizeVideo } from "../ai-service.js";
import { insertChannelSchema, videos, SUPPORTED_PLATFORMS } from "../../shared/schema.js";
import { generateSlug } from "../utils.js";
import { db } from "../db.js";
import { eq } from "drizzle-orm";
import { kvStorage } from "../storage/kv.js";

async function enrichYouTubeChannel(channel: any) {
  const cacheKey = `channel:youtube:about:${channel.id}`;
  const cached = await kvStorage.get(cacheKey);
  if (cached && typeof cached === "object") {
    return { ...channel, ...cached };
  }

  try {
    let description: string | null = null;
    let bannerUrl: string | null = null;

    // Use scraping to get about info
    const about = await scrapeYouTubeChannelAbout(channel.url);
    description = about.description || null;
    bannerUrl = about.bannerUrl || null;

    const payload = {
      description,
      bannerUrl,
    };
    
    await kvStorage.set(cacheKey, payload, 60 * 60 * 24 * 7);
    return { ...channel, ...payload };
  } catch {
    await kvStorage.set(cacheKey, { description: null, bannerUrl: null }, 60 * 60 * 24);
    return { ...channel, description: null, bannerUrl: null };
  }
}

async function asyncPool<T, R>(
  poolLimit: number,
  items: T[],
  iteratorFn: (item: T) => Promise<R>,
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const data = insertChannelSchema.parse(req.body);
    const channel = await storage.createChannel(data);
    console.log(`[channels] Created channel: ${channel.name}`);
    res.json(channel);
  } catch (error) {
    console.error("[channels] Create error:", error);
    res.status(400).json({ error: "Failed to create channel" });
  }
});

router.get("/", async (req, res) => {
  try {
    const rawPlatform = typeof req.query.platform === "string" ? req.query.platform : undefined;
    const platformFilter = rawPlatform && (SUPPORTED_PLATFORMS as readonly string[]).includes(rawPlatform)
      ? rawPlatform
      : undefined;

    const allChannels = await storage.getAllChannels();
    const filtered = platformFilter
      ? allChannels.filter((c) => c.platform === platformFilter)
      : allChannels;
    const base = filtered.map((c) => ({
      ...c,
      slug: `${generateSlug(c.name, 80)}-${c.id}`,
    }));

    const enriched = await asyncPool(3, base, (c) => {
      if (c.platform === "youtube") return enrichYouTubeChannel(c);
      return Promise.resolve({ ...c, description: null, bannerUrl: null });
    });

    res.json(enriched);
  } catch (error) {
    console.error("[channels] Fetch error:", error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const channel = await storage.getChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    const withSlug = {
      ...channel,
      slug: `${generateSlug(channel.name, 80)}-${channel.id}`,
    };
    if (withSlug.platform === "youtube") {
      return res.json(await enrichYouTubeChannel(withSlug));
    }
    res.json({ ...withSlug, description: null, bannerUrl: null });
  } catch (error) {
    console.error("[channels] Fetch by id error:", error);
    res.status(500).json({ error: "Failed to fetch channel" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteChannel(req.params.id);
    console.log(`[channels] Deleted channel: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[channels] Delete error:", error);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

router.post("/:id/scrape", requireAuth, async (req, res) => {
  try {
    const channel = await storage.getChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const { channelInfo, videos: scrapedVideos } = await scrapeYouTubeChannel(
      channel.url,
    );

    const kvKey = `channel:youtube:about:${channel.id}`;
    if (channelInfo.description || channelInfo.bannerUrl) {
      await kvStorage.set(
        kvKey,
        {
          description: channelInfo.description || null,
          bannerUrl: channelInfo.bannerUrl || null,
        },
        60 * 60 * 24 * 7,
      );
    }

    if (channelInfo.channelId || channelInfo.thumbnailUrl) {
      await storage.updateChannel(channel.id, {
        channelId: channelInfo.channelId || channel.channelId,
        thumbnailUrl: channelInfo.thumbnailUrl || channel.thumbnailUrl,
        bannerUrl: channelInfo.bannerUrl, // Store banner URL
        lastScraped: new Date(),
      } as any);
    }

    let savedCount = 0;
    const newVideos: string[] = [];

    for (const scrapedVideo of scrapedVideos) {
      const existing = await storage.getVideoByVideoId(scrapedVideo.videoId);
      if (!existing) {
        const baseSlug = generateSlug(scrapedVideo.title);

        let slug = baseSlug;
        let counter = 1;
        while (true) {
          const existingSlug = await db
            .select()
            .from(videos)
            .where(eq(videos.slug, slug))
            .limit(1);
          if (existingSlug.length === 0) break;
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        const newVideo = await storage.createVideo({
          channelId: channel.id,
          videoId: scrapedVideo.videoId,
          slug,
          title: scrapedVideo.title,
          description: scrapedVideo.description || null,
          thumbnailUrl: scrapedVideo.thumbnailUrl,
          duration: scrapedVideo.duration || null,
          viewCount: scrapedVideo.viewCount || null,
          publishDate: scrapedVideo.publishDate || null,
          videoType: scrapedVideo.videoType || "regular",
        });

        newVideos.push(newVideo.id);
        savedCount++;
      }
    }

    console.log(`[channels] Auto-categorizing ${newVideos.length} new videos...`);
    for (const videoId of newVideos) {
      try {
        const video = await storage.getVideo(videoId);
        if (!video) continue;

        const result = await categorizeVideo(
          video.title,
          video.description || "",
          { timeoutMs: 20000 },
        );

        const categoriesEn = result.categories.en || [];
        const categoriesSr = result.categories.sr || [];
        const maxCategories = Math.max(categoriesEn.length, categoriesSr.length);

        for (let i = 0; i < maxCategories; i++) {
          const nameEn = categoriesEn[i];
          const nameSr = categoriesSr[i];
          
          if (!nameEn) continue;

          const categorySlug = nameEn
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
            
          let category = await storage.getLocalizedCategoryBySlug(categorySlug, 'en');

          if (!category) {
            const translations: { languageCode: string; name: string; slug: string; description: string | null }[] = [];
            translations.push({
              languageCode: 'en',
              name: nameEn,
              slug: categorySlug,
              description: null
            });

            if (nameSr) {
              translations.push({
                languageCode: 'sr-Latn',
                name: nameSr,
                slug: categorySlug,
                description: null
              });
            }

            category = await storage.createCategory({}, translations);
          } else if (nameSr) {
             try {
                await storage.addCategoryTranslation(category.id, {
                  categoryId: category.id,
                  languageCode: 'sr-Latn',
                  name: nameSr,
                  slug: categorySlug,
                  description: null
                }).catch(() => {});
             } catch (e) {
               // Ignore
             }
          }

          await storage.addVideoCategory(video.id, category.id);
        }

        const tagsEn = result.tags.en || [];
        const tagsSr = result.tags.sr || [];
        const maxTags = Math.max(tagsEn.length, tagsSr.length);

        for (let i = 0; i < maxTags; i++) {
          const tagEn = tagsEn[i];
          const tagSr = tagsSr[i];
          
          if (!tagEn) continue;

          const translations = [{
            languageCode: 'en',
            tagName: tagEn
          }];

          if (tagSr) {
             translations.push({
               languageCode: 'sr-Latn',
               tagName: tagSr
             });
          }

          await storage.createTag({
            videoId: video.id,
          }, translations);
        }

        console.log(`[channels] Categorized: ${video.title}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Cannot connect to localhost Ollama on Vercel")) {
          console.warn(`[channels] Skipping categorization (AI unavailable) for ${videoId}: ${message}`);
        } else {
          console.error(`[channels] Failed to categorize video ${videoId}:`, error);
        }
      }
    }

    const allCategories = await storage.getAllLocalizedCategories('en');
    for (const category of allCategories) {
      const categoryVideos = await storage.getAllVideos({
        categoryId: category.id,
      });
      await storage.updateCategory(category.id, {
        videoCount: categoryVideos.length,
      });
    }

    const allChannelVideos = await storage.getAllVideos({
      channelId: channel.id,
    });
    await storage.updateChannel(channel.id, {
      videoCount: allChannelVideos.length,
    });

    console.log(`[channels] Scrape complete for ${channel.name}: ${savedCount} new videos saved`);
    res.json({
      success: true,
      scraped: scrapedVideos.length,
      saved: savedCount,
    });
  } catch (error) {
    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : undefined;
    const message = error instanceof Error ? error.message : String(error);
    if (statusCode === 404 || message.includes("Failed to fetch channel: 404")) {
      console.warn("[channels] Scrape not found:", { channelId: req.params.id, message });
      return res.status(404).json({ error: message });
    }
    console.error("[channels] Scrape error:", error);
    res.status(500).json({ error: "Failed to scrape channel" });
  }
});

export default router;
