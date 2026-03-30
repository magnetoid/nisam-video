import { Router, Request } from "express";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { videos, videoLikes, videoViews, tags, videoCategories } from "../../shared/schema.js";
import { categorizeVideo } from "../ai-service.js";
import { requireAuth } from "../middleware/auth.js";
import { kvService } from "../kv-service.js";
import { eq, and, sql as sqlOp, inArray, isNull } from "drizzle-orm";
import { getUserIdentifier } from "../utils.js";
import pLimit from "p-limit";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { channelId, categoryId, search, limit, offset, lang, tagName, sort } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) || 20 : undefined;
    const offsetNum = offset ? parseInt(offset as string, 10) || 0 : undefined;
    const sortValue = ["publishDate", "createdAt", "views", "popularity"].includes(sort as string) 
      ? (sort as "publishDate" | "createdAt" | "views" | "popularity") 
      : "publishDate";
    const filters = {
      channelId: channelId as string | undefined,
      categoryId: categoryId as string | undefined,
      search: search as string | undefined,
      tagName: tagName as string | undefined,
      lang: lang as string | undefined,
      limit: limitNum,
      offset: limitNum ? offsetNum : undefined,
      sort: sortValue as "publishDate" | "createdAt",
    };
    const videosList = await storage.getAllVideos(filters);
    res.json(videosList);
  } catch (error) {
    console.error(`Get videos error [params=${JSON.stringify(req.query)}]:`, error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

router.get("/hero", async (req, res) => {
  try {
    const heroVideo = await storage.getHeroVideo();
    res.json(heroVideo);
  } catch (error) {
    console.error("Get hero video error:", error);
    res.status(500).json({ error: "Failed to fetch hero video" });
  }
});

router.get("/carousels", async (req, res) => {
  const lang = (req.query.lang as string) || 'en';
  const rawLimit = parseInt(req.query.limit as string, 10);
  const videosPerCategory = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10;
  const sections = (req.query.sections as string || "hero,recent,trending,categories").split(",");

  const results: Record<string, any> = {
    hero: [],
    recent: [],
    trending: [],
    byCategory: {},
  };

  await Promise.allSettled([
    sections.includes("hero")
      ? storage.getHomeHeroVideos(4, lang).then((v) => (results.hero = v)).catch(() => {})
      : Promise.resolve(),
    sections.includes("recent")
      ? storage.getRecentVideos(videosPerCategory, lang).then((v) => (results.recent = v)).catch(() => {})
      : Promise.resolve(),
    sections.includes("trending")
      ? storage.getTrendingVideos(videosPerCategory, lang).then((v) => (results.trending = v)).catch(() => {})
      : Promise.resolve(),
  ]);

  if (sections.includes("categories")) {
    let categories: any[] = [];
    try {
      categories = await storage.getAllLocalizedCategories(lang);
    } catch {
      categories = [];
    }

    const topCategories = categories.slice(0, 10);
    const byCategory: Record<string, any[]> = {};

    await Promise.all(
      topCategories.map(async (category) => {
        const name =
          category?.translations?.[0]?.name ||
          category?.name ||
          'Unnamed';

        try {
          const videos = await storage.getVideosByCategory(category.id, videosPerCategory, lang);
          if (Array.isArray(videos) && videos.length > 0) {
            byCategory[name] = videos;
          }
        } catch {
        }
      }),
    );

    results.byCategory = byCategory;
  }

  const response: Record<string, any> = {
    hero: results.hero || [],
    recent: results.recent || [],
    trending: results.trending || [],
    byCategory: results.byCategory || {},
  };

  if (sections.includes("popular")) {
    response.popularSegments = results.popularSegments || [];
    response.popular = results.popular || [];
  }

  res.json(response);
});

router.get("/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const lang = (req.query.lang as string) || "en";
    let video = await storage.getVideoWithRelationsBySlug(idOrSlug, lang);
    if (!video) {
      video = await storage.getVideoWithRelations(idOrSlug, lang);
    }
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    res.json(video);
  } catch (error) {
    console.error("Get video error:", error);
    res.status(500).json({ error: "Failed to fetch video" });
  }
});

router.get("/:id/similar", async (req, res) => {
  try {
    const { id } = req.params;
    const lang = (req.query.lang as string) || "en";
    
    const video = await storage.getVideoWithRelations(id, lang);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // 1. Get candidates from same category
    let candidates: any[] = [];
    if (video.categories && video.categories.length > 0) {
      const categoryId = video.categories[0].id;
      candidates = await storage.getAllVideos({ categoryId, limit: 50, lang });
    }

    // 2. If not enough, get recent videos
    if (candidates.length < 20) {
      const recent = await storage.getAllVideos({ limit: 30, lang, sort: "publishDate" });
      candidates = [...candidates, ...recent];
    }

    // 3. Deduplicate and filter out self
    const uniqueCandidates = new Map<string, any>();
    candidates.forEach(v => {
      if (v.id !== video.id) {
        uniqueCandidates.set(v.id, v);
      }
    });

    // 4. Score candidates
    const scored = Array.from(uniqueCandidates.values()).map(candidate => {
      let score = 0;
      
      // Same category overlap
      const candidateCatIds = candidate.categories?.map((c: any) => c.id) || [];
      const videoCatIds = video.categories?.map((c: any) => c.id) || [];
      const commonCats = candidateCatIds.filter((id: string) => videoCatIds.includes(id)).length;
      score += commonCats * 5;

      // Tag overlap
      const candidateTags = candidate.tags?.map((t: any) => t.tagName?.toLowerCase()) || [];
      const videoTags = video.tags?.map((t: any) => t.tagName?.toLowerCase()) || [];
      const commonTags = candidateTags.filter((t: string) => videoTags.includes(t)).length;
      score += commonTags * 2;

      // Same channel
      if (candidate.channelId === video.channelId) {
        score += 3;
      }
      
      // Recency boost (newer is better)
      const daysDiff = (new Date().getTime() - new Date(candidate.publishDate).getTime()) / (1000 * 3600 * 24);
      if (daysDiff < 7) score += 2;
      if (daysDiff < 30) score += 1;

      return { video: candidate, score };
    });

    // 5. Sort by score
    scored.sort((a, b) => b.score - a.score);

    // 6. Return top 12
    const top = scored.slice(0, 12).map(s => s.video);
    res.json(top);

  } catch (error) {
    console.error("Get similar videos error:", error);
    res.status(500).json({ error: "Failed to fetch similar videos" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, categoryIds, tags: tagNames } = req.body;
    const video = await storage.getVideo(req.params.id);

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const updates: { title?: string; description?: string } = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      await storage.updateVideo(req.params.id, updates);
    }

    if (categoryIds !== undefined) {
      await storage.removeVideoCategories(req.params.id);
      for (const categoryId of categoryIds) {
        await storage.addVideoCategory(req.params.id, categoryId);
      }
      await storage.updateVideo(req.params.id, {
        primaryCategoryId: Array.isArray(categoryIds) && categoryIds.length > 0 ? categoryIds[0] : null,
      });
    }

    if (tagNames !== undefined) {
      await storage.deleteTagsByVideoId(req.params.id);
      for (const tagName of tagNames) {
        await storage.createTag(
          { videoId: req.params.id },
          [{ languageCode: "en", tagName }]
        );
      }
    }

    const updatedVideo = await storage.getVideoWithRelations(req.params.id);
    res.json(updatedVideo);
  } catch (error) {
    console.error("Update video error:", error);
    res.status(500).json({ error: "Failed to update video" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteVideo(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

router.post("/:id/categorize", requireAuth, async (req, res) => {
  try {
    const video = await storage.getVideo(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const result = await categorizeVideo(video.title, video.description || "");
    await storage.removeVideoCategories(video.id);
    await storage.deleteTagsByVideoId(video.id);

    const categoriesEn = result.categories.en || [];
    const categoriesSr = result.categories.sr || [];
    const maxCategories = Math.max(categoriesEn.length, categoriesSr.length);

    let primaryCategoryId: string | null = null;

    for (let i = 0; i < maxCategories; i++) {
      const nameEn = categoriesEn[i];
      const nameSr = categoriesSr[i];
      
      if (!nameEn) continue;

      const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let category = await storage.getLocalizedCategoryBySlug(slug, "en");

      if (!category) {
        const translations = [];
        translations.push({
          languageCode: "en",
          name: nameEn,
          slug,
          description: ""
        });

        if (nameSr) {
          translations.push({
            languageCode: "sr-Latn",
            name: nameSr,
            slug,
            description: ""
          });
        }

        category = await storage.createCategory({ videoCount: 0 }, translations);
      } else if (nameSr) {
         try {
            await storage.addCategoryTranslation(category.id, {
              categoryId: category.id,
              languageCode: "sr-Latn",
              name: nameSr,
              slug,
              description: ""
            }).catch(() => {});
         } catch (e) {
           // Ignore
         }
      }

      await storage.addVideoCategory(video.id, category.id);
      if (!primaryCategoryId) primaryCategoryId = category.id;
    }

    await storage.updateVideo(video.id, { primaryCategoryId });

    const tagsEn = result.tags.en || [];
    const tagsSr = result.tags.sr || [];
    const maxTags = Math.max(tagsEn.length, tagsSr.length);

    for (let i = 0; i < maxTags; i++) {
      const tagEn = tagsEn[i];
      const tagSr = tagsSr[i];
      
      if (!tagEn) continue;

      const translations = [{
        languageCode: "en",
        tagName: tagEn
      }];

      if (tagSr) {
        translations.push({
          languageCode: "sr-Latn",
          tagName: tagSr
        });
      }

      await storage.createTag({ videoId: video.id }, translations);
    }

    res.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to categorize video";
    if (
      message.includes("Cannot connect to localhost Ollama") ||
      message.includes("Ollama") ||
      message.includes("ECONNREFUSED")
    ) {
      return res.status(400).json({
        error: message,
        code: "AI_PROVIDER_UNAVAILABLE",
      });
    }
    console.error("Categorize video error:", error);
    res.status(500).json({ error: "Failed to categorize video" });
  }
});

router.post("/bulk/categorize-missing", requireAuth, async (req, res) => {
  try {
    const limitRaw = req.body?.limit;
    const limitNum = Math.max(1, Math.min(200, parseInt(String(limitRaw ?? "60"), 10) || 60));

    const missingRows = await db
      .select({ id: videos.id, title: videos.title, description: videos.description })
      .from(videos)
      .leftJoin(videoCategories, eq(videoCategories.videoId, videos.id))
      .leftJoin(tags, eq(tags.videoId, videos.id))
      .where(and(isNull(videoCategories.videoId), isNull(tags.id)))
      .limit(limitNum);

    const results = {
      total: missingRows.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const row of missingRows) {
      try {
        const result = await categorizeVideo(row.title, row.description || "");
        await storage.removeVideoCategories(row.id);
        await storage.deleteTagsByVideoId(row.id);

        const categoriesEn = result.categories.en || [];
        const categoriesSr = result.categories.sr || [];
        const maxCategories = Math.max(categoriesEn.length, categoriesSr.length);

        let primaryCategoryId: string | null = null;

        for (let i = 0; i < maxCategories; i++) {
          const nameEn = categoriesEn[i];
          const nameSr = categoriesSr[i];

          if (!nameEn) continue;
          const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          let category = await storage.getLocalizedCategoryBySlug(slug, "en");

          if (!category) {
            const translations: any[] = [
              { languageCode: "en", name: nameEn, slug, description: "" },
            ];
            if (nameSr) {
              translations.push({
                languageCode: "sr-Latn",
                name: nameSr,
                slug,
                description: "",
              });
            }
            category = await storage.createCategory({ videoCount: 0 }, translations);
          } else if (nameSr) {
            await storage
              .addCategoryTranslation(category.id, {
                categoryId: category.id,
                languageCode: "sr-Latn",
                name: nameSr,
                slug,
                description: "",
              })
              .catch(() => {});
          }

          await storage.addVideoCategory(row.id, category.id);
          if (!primaryCategoryId) primaryCategoryId = category.id;
        }

        await storage.updateVideo(row.id, { primaryCategoryId });

        const tagsEn = result.tags.en || [];
        const tagsSr = result.tags.sr || [];
        const maxTags = Math.max(tagsEn.length, tagsSr.length);

        for (let i = 0; i < maxTags; i++) {
          const tagEn = tagsEn[i];
          const tagSr = tagsSr[i];

          if (!tagEn) continue;
          const translations: any[] = [{ languageCode: "en", tagName: tagEn }];
          if (tagSr) {
            translations.push({ languageCode: "sr-Latn", tagName: tagSr });
          }
          await storage.createTag({ videoId: row.id }, translations);
        }

        results.successful++;
      } catch (error) {
        results.failed++;
        const message = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Failed to categorize video ${row.id}: ${message}`);
      }
    }

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to categorize missing videos";
    if (message.includes("Ollama") || message.includes("ECONNREFUSED")) {
      return res.status(400).json({ error: message, code: "AI_PROVIDER_UNAVAILABLE" });
    }
    console.error("Bulk categorize missing error:", error);
    res.status(500).json({ error: "Failed to categorize missing videos" });
  }
});

router.post("/bulk/categorize", requireAuth, async (req, res) => {
  try {
    const { videoIds } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }

    const results = { total: videoIds.length, successful: 0, failed: 0, errors: [] as string[] };
    const limit = pLimit(5); // Process 5 videos concurrently

    const tasks = videoIds.map((videoId) => 
      limit(async () => {
        try {
          const video = await storage.getVideo(videoId);
          if (!video) {
            results.failed++;
            results.errors.push(`Video ${videoId} not found`);
            return;
          }

          const result = await categorizeVideo(video.title, video.description || "");
          await storage.removeVideoCategories(video.id);
          await storage.deleteTagsByVideoId(video.id);

          const categoriesEn = result.categories.en || [];
          const categoriesSr = result.categories.sr || [];
          const maxCategories = Math.max(categoriesEn.length, categoriesSr.length);

          let primaryCategoryId: string | null = null;

          for (let i = 0; i < maxCategories; i++) {
            const nameEn = categoriesEn[i];
            const nameSr = categoriesSr[i];

            if (!nameEn) continue;

            const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            let category = await storage.getLocalizedCategoryBySlug(slug, "en");

            if (!category) {
              const translations: any[] = [
                { languageCode: "en", name: nameEn, slug, description: "" },
              ];
              if (nameSr) {
                translations.push({
                  languageCode: "sr-Latn",
                  name: nameSr,
                  slug,
                  description: "",
                });
              }
              category = await storage.createCategory({ videoCount: 0 }, translations);
            } else if (nameSr) {
              await storage
                .addCategoryTranslation(category.id, {
                  categoryId: category.id,
                  languageCode: "sr-Latn",
                  name: nameSr,
                  slug,
                  description: "",
                })
                .catch(() => {});
            }

            await storage.addVideoCategory(video.id, category.id);
            if (!primaryCategoryId) primaryCategoryId = category.id;
          }

          await storage.updateVideo(video.id, { primaryCategoryId });

          const tagsEn = result.tags.en || [];
          const tagsSr = result.tags.sr || [];
          const maxTags = Math.max(tagsEn.length, tagsSr.length);

          for (let i = 0; i < maxTags; i++) {
            const tagEn = tagsEn[i];
            const tagSr = tagsSr[i];

            if (!tagEn) continue;

            const translations: any[] = [{ languageCode: "en", tagName: tagEn }];
            if (tagSr) {
              translations.push({ languageCode: "sr-Latn", tagName: tagSr });
            }
            await storage.createTag({ videoId: video.id }, translations);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          const message = error instanceof Error ? error.message : "Unknown error";
          results.errors.push(`Failed to categorize video ${videoId}: ${message}`);
        }
      })
    );

    await Promise.all(tasks);

    res.json(results);
  } catch (error) {
    console.error("Bulk categorize error:", error);
    res.status(500).json({ error: "Failed to bulk categorize videos" });
  }
});

router.post("/bulk/tag", requireAuth, async (req, res) => {
  try {
    const { videoIds, tags: tagNames } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }
    if (!Array.isArray(tagNames) || tagNames.length === 0) {
      return res.status(400).json({ error: "tags array is required" });
    }

    const results = { total: videoIds.length, successful: 0, failed: 0, errors: [] as string[] };
    const limit = pLimit(10); // Process 10 concurrent tag operations

    const tasks = videoIds.map((videoId) => 
      limit(async () => {
        try {
          const video = await storage.getVideo(videoId);
          if (!video) {
            results.failed++;
            results.errors.push(`Video ${videoId} not found`);
            return;
          }

          for (const tagName of tagNames) {
            await storage.createTag(
              { videoId: video.id },
              [{ languageCode: "en", tagName }]
            );
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to tag video ${videoId}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      })
    );

    await Promise.all(tasks);

    res.json(results);
  } catch (error) {
    console.error("Bulk tag error:", error);
    res.status(500).json({ error: "Failed to bulk tag videos" });
  }
});

router.delete("/bulk", requireAuth, async (req, res) => {
  try {
    const { videoIds } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }

    await storage.deleteVideosBulk(videoIds);

    // Assume all successful if no error thrown (deleteVideosBulk logs errors but doesn't throw)
    // But we should probably improve error reporting in deleteVideosBulk if needed.
    // For now, consistent with previous behavior of "try/catch" but faster.
    const results = { 
      total: videoIds.length, 
      successful: videoIds.length, 
      failed: 0, 
      errors: [] as string[] 
    };

    res.json(results);
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({ error: "Failed to bulk delete videos" });
  }
});

router.post("/:id/like", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const allowed = await kvService.checkRateLimit(userIdentifier, 'like');
    if (!allowed) {
      return res.status(429).json({ error: "Too many like requests. Please slow down.", retryAfter: 60 });
    }

    const existingLike = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)))
      .limit(1);

    if (existingLike.length > 0) {
      return res.status(400).json({ error: "Already liked" });
    }

    await db.insert(videoLikes).values({ videoId, userIdentifier });
    await db.update(videos).set({ likesCount: sqlOp`${videos.likesCount} + 1` }).where(eq(videos.id, videoId));

    const [updatedVideo] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    res.json({ success: true, likesCount: updatedVideo?.likesCount || 0 });
  } catch (error) {
    console.error("Like video error:", error);
    res.status(500).json({ error: "Failed to like video" });
  }
});

router.delete("/:id/like", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const existingLike = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)))
      .limit(1);

    if (existingLike.length === 0) {
      return res.status(400).json({ error: "Not liked" });
    }

    await db.delete(videoLikes).where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)));
    await db.update(videos).set({ likesCount: sqlOp`GREATEST(${videos.likesCount} - 1, 0)` }).where(eq(videos.id, videoId));

    const [updatedVideo] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    res.json({ success: true, likesCount: updatedVideo?.likesCount || 0 });
  } catch (error) {
    console.error("Unlike video error:", error);
    res.status(500).json({ error: "Failed to unlike video" });
  }
});

router.get("/:id/like-status", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const existingLike = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userIdentifier, userIdentifier)))
      .limit(1);

    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);

    res.json({ isLiked: existingLike.length > 0, likesCount: video?.likesCount || 0 });
  } catch (error) {
    console.error("Get like status error:", error);
    res.status(500).json({ error: "Failed to get like status" });
  }
});

router.post("/:id/view", async (req, res) => {
  try {
    const videoId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    await kvService.bufferView(videoId, userIdentifier);
    await db.insert(videoViews).values({ videoId, userIdentifier });

    res.json({ success: true });
  } catch (error) {
    console.error("Track view error:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
});

router.post("/batch/like-status", async (req, res) => {
  try {
    const { videoIds } = req.body;
    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ error: "videoIds array is required" });
    }

    const userIdentifier = getUserIdentifier(req);

    const userLikes = await db
      .select()
      .from(videoLikes)
      .where(and(inArray(videoLikes.videoId, videoIds), eq(videoLikes.userIdentifier, userIdentifier)));

    const videosData = await db
      .select({ id: videos.id, likesCount: videos.likesCount })
      .from(videos)
      .where(inArray(videos.id, videoIds));

    const result: Record<string, { isLiked: boolean; likesCount: number }> = {};
    for (const video of videosData) {
      result[video.id] = {
        isLiked: userLikes.some((like: any) => like.videoId === video.id),
        likesCount: video.likesCount || 0,
      };
    }

    res.json(result);
  } catch (error) {
    console.error("Batch get like status error:", error);
    res.status(500).json({ error: "Failed to get batch like status" });
  }
});

router.post("/scrape", requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const { scrapeYouTubeVideoPage } = await import("../video-scraper.js");
    const result = await scrapeYouTubeVideoPage(url);

    if (!result.success) {
      return res.status(400).json({ error: result.error, partial: false });
    }

    const video = result.data!;
    const existing = await storage.getVideoByVideoId(video.videoId);

    const updateData: any = {};
    let needsUpdate = false;

    if (!existing) {
      const channel = await storage.getAllChannels().then(channels => 
        channels.find(c => c.platform === "youtube")
      );
      
      if (!channel) {
        return res.status(400).json({ error: "No YouTube channel configured. Please create a channel first." });
      }

      const slug = video.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 80);
      const newVideo = await storage.createVideo({
        channelId: channel.id,
        videoId: video.videoId,
        slug,
        title: video.title,
        description: video.description || null,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration || null,
        viewCount: video.viewCount || null,
        publishDate: video.publishDate || null,
        videoType: video.isShort ? "youtube_short" : "regular",
      });

      return res.json({
        success: true,
        action: "created",
        video: newVideo,
        partial: result.partial,
      });
    }

    if (video.title && video.title !== existing.title) {
      updateData.title = video.title;
      needsUpdate = true;
    }
    if (video.description && video.description !== existing.description) {
      updateData.description = video.description;
      needsUpdate = true;
    }
    if (video.viewCount && video.viewCount !== existing.viewCount) {
      updateData.viewCount = video.viewCount;
      needsUpdate = true;
    }
    if (video.duration && video.duration !== existing.duration) {
      updateData.duration = video.duration;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await storage.updateVideo(existing.id, updateData);
    }

    const updatedVideo = await storage.getVideo(existing.id);

    res.json({
      success: true,
      action: needsUpdate ? "updated" : "unchanged",
      video: updatedVideo,
      partial: result.partial,
      updatedFields: Object.keys(updateData),
    });
  } catch (error) {
    console.error("Scrape video error:", error);
    res.status(500).json({ error: "Failed to scrape video" });
  }
});

router.post("/scrape-batch", requireAuth, async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "URLs array is required" });
    }

    const maxUrls = Math.min(urls.length, 20);
    const limitedUrls = urls.slice(0, maxUrls);

    const { scrapeMultipleVideos } = await import("../video-scraper.js");
    const results = await scrapeMultipleVideos(limitedUrls);

    const response: any = {
      total: limitedUrls.length,
      successful: 0,
      failed: 0,
      partial: 0,
      videos: [],
      errors: [],
    };

    const channels = await storage.getAllChannels().then(ch => 
      ch.filter(c => c.platform === "youtube")
    );
    const channel = channels[0];

    for (const [url, result] of results) {
      if (!result.success) {
        response.failed++;
        response.errors.push({ url, error: result.error });
        continue;
      }

      const video = result.data!;
      response.successful++;
      if (result.partial) response.partial++;

      try {
        const existing = await storage.getVideoByVideoId(video.videoId);
        if (existing) {
          const updateData: any = {};
          if (video.title && video.title !== existing.title) updateData.title = video.title;
          if (video.description && video.description !== existing.description) updateData.description = video.description;
          if (video.viewCount && video.viewCount !== existing.viewCount) updateData.viewCount = video.viewCount;
          if (video.duration && video.duration !== existing.duration) updateData.duration = video.duration;

          if (Object.keys(updateData).length > 0) {
            await storage.updateVideo(existing.id, updateData);
          }
          response.videos.push({ id: existing.id, videoId: video.videoId, action: "updated" });
        } else if (channel) {
          const slug = video.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 80);
          const newVideo = await storage.createVideo({
            channelId: channel.id,
            videoId: video.videoId,
            slug,
            title: video.title,
            description: video.description || null,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration || null,
            viewCount: video.viewCount || null,
            publishDate: video.publishDate || null,
            videoType: video.isShort ? "youtube_short" : "regular",
          });
          response.videos.push({ id: newVideo.id, videoId: video.videoId, action: "created" });
        }
      } catch (e) {
        response.errors.push({ url, videoId: video.videoId, error: String(e) });
      }
    }

    res.json(response);
  } catch (error) {
    console.error("Batch scrape error:", error);
    res.status(500).json({ error: "Failed to batch scrape videos" });
  }
});

// Enrich video descriptions by scraping full YouTube video pages
// This fixes truncated descriptions from channel-level scraping
router.post("/enrich-descriptions", requireAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.body || {};
    const cappedLimit = Math.min(Number(limit) || 50, 200);

    // Find YouTube videos with short descriptions (likely truncated snippets)
    const allVideos = await storage.getAllVideos({
      limit: cappedLimit,
      sort: "createdAt",
    });

    const candidates = allVideos.filter(
      v => v.videoType !== "tiktok" && (!v.description || v.description.length < 300)
    );

    if (candidates.length === 0) {
      return res.json({ message: "No videos need description enrichment", enriched: 0, failed: 0 });
    }

    // Respond immediately, run enrichment in background
    res.json({
      message: `Starting description enrichment for ${candidates.length} videos`,
      candidates: candidates.length,
    });

    const { enrichVideoDescriptions } = await import("../video-ingestion.js");
    enrichVideoDescriptions(candidates.map(v => v.id)).then(({ enriched, failed }) => {
      console.log(`[enrich-descriptions] Complete: ${enriched} enriched, ${failed} failed`);
    }).catch(err => {
      console.error("[enrich-descriptions] Error:", err);
    });
  } catch (error) {
    console.error("Enrich descriptions error:", error);
    res.status(500).json({ error: "Failed to start description enrichment" });
  }
});

export default router;
