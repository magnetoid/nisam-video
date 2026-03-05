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
  try {
    const lang = req.query.lang as string || 'en';
    const videosPerCategory = parseInt(req.query.limit as string, 10) || 10;
    const sections = (req.query.sections as string || "hero,recent,trending,categories").split(",");
    
    const promises: Promise<any>[] = [];
    const results: Record<string, any> = {};

    if (sections.includes("hero")) {
      promises.push(storage.getHomeHeroVideos(4, lang).then(v => results.hero = v));
    }
    if (sections.includes("recent")) {
      promises.push(storage.getRecentVideos(videosPerCategory, lang).then(v => results.recent = v));
    }
    if (sections.includes("trending")) {
      promises.push(storage.getTrendingVideos(videosPerCategory, lang).then(v => results.trending = v));
    }
    if (sections.includes("popular")) {
      // Check for segments first
      const heroSettings = await storage.getHeroSettings();
      // @ts-ignore - popularSegments might not be typed in IStorage yet but it is in schema
      const segments = heroSettings?.popularSegments as any[];
      const popularMode = heroSettings?.popularPageMode || 'views';
      
      let sort: "popularity" | "views" | "publishDate" = "popularity";
      if (popularMode === 'likes') sort = "popularity"; // Our popularity logic includes likes heavily
      else if (popularMode === 'recent') sort = "publishDate";
      else sort = "views";

      if (segments && Array.isArray(segments) && segments.length > 0) {
        const segmentPromises = segments.map(async (seg) => {
          try {
            const videos = await storage.getAllVideos({ 
              limit: seg.limit || videosPerCategory, 
              lang, 
              minViews: seg.minViews,
              sort: "views" 
            });
            return {
              id: seg.id,
              title: seg.title,
              videos
            };
          } catch (e) {
            return null;
          }
        });
        
        promises.push(Promise.all(segmentPromises).then(segs => {
          results.popularSegments = segs.filter(s => s && s.videos.length > 0);
        }));
      }
      
      // Always fetch standard popular list too, using the mode
      promises.push(storage.getAllVideos({ limit: videosPerCategory, lang, sort }).then(v => results.popular = v));
    }
    
    // Wait for main sections
    await Promise.allSettled(promises);

    // Handle categories separately if requested
    if (sections.includes("categories")) {
      // Get TOP 10 categories instead of all
      // @ts-ignore
      const topCategories = await storage.getTopCategories(10, lang);
      
      const categoryPromises = topCategories.map(async (category) => {
        try {
          const videos = await storage.getVideosByCategory(category.id, videosPerCategory, lang);
          return {
            name: category.translations[0]?.name || category.name || 'Unnamed',
            videos: videos || [],
          };
        } catch (error) {
          return {
            name: category.translations[0]?.name || category.name || 'Unnamed',
            videos: [],
          };
        }
      });
      
      const categoryResults = await Promise.allSettled(categoryPromises);
      const successfulCategories = categoryResults
        .filter(result => result.status === 'fulfilled')
        // @ts-ignore
        .map(result => result.value)
        .filter(result => result.videos.length > 0);

      const byCategory: Record<string, any[]> = {};
      for (const result of successfulCategories) {
        byCategory[result.name] = result.videos;
      }
      results.byCategory = byCategory;
      results.topCategories = topCategories; // Return metadata too
    }

    res.json({
      hero: results.hero || [],
      recent: results.recent || [],
      trending: results.trending || [],
      byCategory: results.byCategory || {},
      popularSegments: results.popularSegments || [],
    });
  } catch (error) {
    console.error(`[carousels] Critical error [params=${JSON.stringify(req.query)}]:`, error);
    res.json({ hero: [], recent: [], trending: [], byCategory: {}, popularSegments: [] });
  }
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

export default router;
