import { Router, Request } from "express";
import { storage } from "../storage.js";
import { categorizeVideo, generateVideoSummary, generateSeoMetadata } from "../ai-service.js";
import { requireAuth } from "../middleware/auth.js";
import { kvService } from "../kv-service.js";
import { generateSlug, ensureUniqueSlug } from "../utils.js";
import { ObjectStorageService } from "../replit_integrations/object_storage/index.js";
import { z } from "zod";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import {
  insertHeroVideoSchema,
  insertHeroImageSchema,
  insertHeroSettingsSchema,
  insertAnalyticsEventSchema,
} from "../../shared/schema.js";
import { tags, tagTranslations, aiSettings } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { errorLogBus, listBookmarks, listErrorEvents, toggleBookmark } from "../error-log-service.js";
import { invalidateCacheOnMutation } from "../cache-middleware.js";
import { getPerformanceSummary } from "../performance-metrics.js";

const router = Router();

router.use(invalidateCacheOnMutation("^http-private:"));

// ... (existing code)

// Admin-only SQL Migration Runner
router.get("/users", requireAuth, async (_req, res) => {
  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.delete("/users/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.patch("/users/:id/role", requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role is required" });
    const user = await storage.updateUserRole(req.params.id, role);
    res.json(user);
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

router.post("/run-migration", requireAuth, async (req, res) => {
  try {
    // Check if tables already exist before attempting to create them
    const tableCheckSql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ai_settings', 'ai_models', 'seo_meta_tags', 'kv_store')
    `;
    
    const existingTables = await db.execute(sql.raw(tableCheckSql));
    const existingTableNames = existingTables.rows.map((row: any) => row.table_name);
    
    // Only create tables that don't already exist
    const tablesToCreate = ['ai_settings', 'ai_models', 'seo_meta_tags', 'kv_store'].filter(
      tableName => !existingTableNames.includes(tableName)
    );
    
    if (tablesToCreate.length === 0) {
      return res.json({ success: true, message: "All tables already exist" });
    }
    
    let migrationSql = '';
    
    if (tablesToCreate.includes('ai_settings')) {
      migrationSql += `
        CREATE TABLE IF NOT EXISTS "ai_settings" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          "provider" text DEFAULT 'openai' NOT NULL,
          "openai_api_key" text,
          "openai_base_url" text,
          "openai_model" text DEFAULT 'gpt-5',
          "ollama_url" text DEFAULT 'http://localhost:11434',
          "ollama_model" text,
          "ollama_api_key" text,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
      `;
    } else {
      // Check for missing columns in ai_settings if table exists
      try {
        const aiSettingsColumns = await db.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'ai_settings'
        `);
        const existingColumns = aiSettingsColumns.rows.map((row: any) => row.column_name);
        
        if (!existingColumns.includes('ollama_api_key')) {
          await db.execute(sql`ALTER TABLE "ai_settings" ADD COLUMN "ollama_api_key" text`);
        }
      } catch (e) {
        console.warn("Failed to alter ai_settings table:", e);
      }
    }
    
    if (tablesToCreate.includes('ai_models')) {
      migrationSql += `
        CREATE TABLE IF NOT EXISTS "ai_models" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          "provider" text NOT NULL,
          "name" text NOT NULL,
          "size" varchar,
          "digest" text,
          "family" text,
          "format" text,
          "parameter_size" text,
          "quantization_level" text,
          "is_active" boolean DEFAULT true NOT NULL,
          "last_synced_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "ai_models_provider_name_unique" UNIQUE("provider", "name")
        );
      `;
    }
    
    if (tablesToCreate.includes('seo_meta_tags')) {
      migrationSql += `
        CREATE TABLE IF NOT EXISTS "seo_meta_tags" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "page_url" text NOT NULL,
          "page_type" text NOT NULL,
          "title" text,
          "description" text,
          "keywords" text,
          "og_title" text,
          "og_description" text,
          "og_image" text,
          "twitter_title" text,
          "twitter_description" text,
          "twitter_image" text,
          "canonical_url" text,
          "schema_markup" json,
          "is_active" boolean DEFAULT true NOT NULL,
          "seo_score" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS "seo_meta_tags_page_type_idx" ON "seo_meta_tags" USING btree ("page_type");
        CREATE INDEX IF NOT EXISTS "seo_meta_tags_is_active_idx" ON "seo_meta_tags" USING btree ("is_active");
        CREATE INDEX IF NOT EXISTS "seo_meta_tags_created_at_idx" ON "seo_meta_tags" USING btree ("created_at");
        CREATE UNIQUE INDEX IF NOT EXISTS "seo_meta_tags_page_url_idx" ON "seo_meta_tags" USING btree ("page_url");
      `;
    }
    
    if (tablesToCreate.includes('kv_store')) {
      migrationSql += `
        CREATE TABLE IF NOT EXISTS "kv_store" (
          "key" text PRIMARY KEY,
          "value" json,
          "expires_at" timestamp
        );
      `;
    }
    
    if (migrationSql.trim() !== '') {
      await db.execute(sql.raw(migrationSql));
    }
    
    res.json({ success: true, message: "Migration applied successfully" });
  } catch (error: any) {
    console.error("Migration error:", error);
    // Don't expose internal error details to client
    res.status(500).json({ error: "Failed to run migration" });
  }
});

// ... (rest of existing code)

function getUserIdentifier(req: Request): string {
  return req.sessionID || req.ip || "anonymous";
}

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    res.json({ message: "Use existing endpoints for stats" });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

router.get("/categories", requireAuth, async (_req, res) => {
  try {
    const categories = await storage.getAllCategoriesWithTranslations();
    res.json(categories);
  } catch (error) {
    console.error("Get admin categories error:", error);
    res.status(500).json({ error: "Failed to fetch admin categories" });
  }
});

router.get("/error-logs", requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const level = typeof req.query.level === "string" ? req.query.level : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const module = typeof req.query.module === "string" ? req.query.module : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const fingerprint =
      typeof req.query.fingerprint === "string" ? req.query.fingerprint : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limitRaw = typeof req.query.limit === "string" ? req.query.limit : undefined;
    const limit = Math.max(1, Math.min(200, parseInt(limitRaw || "50", 10) || 50));
    const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
    const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;
    const bookmarkedRaw =
      typeof req.query.bookmarked === "string" ? req.query.bookmarked : undefined;
    const bookmarked = bookmarkedRaw === "true" ? true : bookmarkedRaw === "false" ? false : undefined;

    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;

    const data = await listErrorEvents({
      q,
      level,
      type,
      module,
      userId,
      fingerprint,
      from: from && !isNaN(from.getTime()) ? from : undefined,
      to: to && !isNaN(to.getTime()) ? to : undefined,
      bookmarked: bookmarked === true ? true : undefined,
      limit,
      cursor,
    });

    res.json(data);
  } catch (error) {
    console.error("Get error logs error:", error);
    res.status(500).json({ error: "Failed to fetch error logs" });
  }
});

router.get("/error-logs/stream", requireAuth, async (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const onEvent = (evt: any) => {
    res.write(`event: error_event\n`);
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  };

  errorLogBus.on("error_event", onEvent);

  const ping = setInterval(() => {
    res.write(`event: ping\n`);
    res.write(`data: ${Date.now()}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(ping);
    errorLogBus.off("error_event", onEvent);
  });
});

router.get("/error-logs/bookmarks", requireAuth, async (_req, res) => {
  try {
    res.json(await listBookmarks());
  } catch (error) {
    console.error("Get error bookmarks error:", error);
    res.status(500).json({ error: "Failed to fetch bookmarks" });
  }
});

router.post("/error-logs/bookmarks", requireAuth, async (req, res) => {
  try {
    const fingerprint = typeof req.body?.fingerprint === "string" ? req.body.fingerprint : null;
    if (!fingerprint) return res.status(400).json({ error: "fingerprint is required" });
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    res.json(await toggleBookmark(fingerprint, note));
  } catch (error) {
    console.error("Toggle error bookmark error:", error);
    res.status(500).json({ error: "Failed to update bookmark" });
  }
});

router.get("/error-logs/export", requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const level = typeof req.query.level === "string" ? req.query.level : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const module = typeof req.query.module === "string" ? req.query.module : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
    const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;

    const data = await listErrorEvents({
      q,
      level,
      type,
      module,
      userId,
      from: from && !isNaN(from.getTime()) ? from : undefined,
      to: to && !isNaN(to.getTime()) ? to : undefined,
      bookmarked: undefined,
      limit: 5000,
      cursor: undefined,
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"error-logs.json\"");
    res.send(JSON.stringify(data.items));
  } catch (error) {
    console.error("Export error logs error:", error);
    res.status(500).json({ error: "Failed to export error logs" });
  }
});

router.get("/ai-status", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(aiSettings).limit(1);
    const cfg = rows[0];
    res.json({
      provider: cfg?.provider || "ollama",
      openai: {
        configured: Boolean(cfg?.openaiApiKey && cfg.openaiApiKey.trim().length > 0),
        model: cfg?.openaiModel || "gpt-4o-mini",
        baseUrlConfigured: Boolean(cfg?.openaiBaseUrl && cfg.openaiBaseUrl.trim().length > 0),
      },
      ollama: {
        configured: Boolean(cfg?.ollamaUrl && cfg.ollamaUrl.trim().length > 0),
        model: cfg?.ollamaModel || "llama3",
        url: cfg?.ollamaUrl || "http://localhost:11434",
      },
    });
  } catch (error: any) {
    if (error?.code === "42P01") {
      return res.json({
        provider: "ollama",
        openai: { configured: false, model: "gpt-4o-mini", baseUrlConfigured: true },
        ollama: { configured: true, model: "llama3", url: "http://localhost:11434" },
      });
    }
    console.error("AI status error:", error);
    res.json({
      provider: "ollama",
      openai: { configured: false, model: "gpt-4o-mini", baseUrlConfigured: true },
      ollama: { configured: false, model: "llama3", url: "http://localhost:11434" },
    });
  }
});

router.post("/regenerate", requireAuth, async (req, res) => {
  try {
    const type = (req.query.type as string) || "all";
    if (type !== "all" && type !== "categories" && type !== "tags") {
      return res.status(400).json({ error: "Invalid type" });
    }

    const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10) || 0);
    const limit = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit as string) || "1", 10) || 1),
    );

    const allVideos = await storage.getAllVideos();
    const mode = (req.query.mode as string) || "all";

    let targetVideos = allVideos;
    if (mode === "missing") {
      targetVideos = allVideos.filter((v) => {
        if (type === "categories") return v.categories.length === 0;
        if (type === "tags") return v.tags.length === 0;
        return v.categories.length === 0 || v.tags.length === 0;
      });
    }

    const total = targetVideos.length;
    
    let batch;
    let nextOffset;

    if (mode === "missing") {
      batch = targetVideos.slice(0, limit);
      nextOffset = 0;
    } else {
      batch = targetVideos.slice(offset, offset + limit);
      nextOffset = Math.min(total, offset + limit);
    }

    let processed = 0;
    let categoriesGenerated = 0;
    let tagsGenerated = 0;

    for (const video of batch) {
      try {
        const startedAt = Date.now();
        const categorizeResult = await categorizeVideo(
          video.title,
          video.description || "",
          { timeoutMs: 20000 },
        );

        if (type === "all" || type === "categories") {
          const categoriesEn = categorizeResult.categories.en || [];
          const categoriesSr = categorizeResult.categories.sr || [];
          const maxCategories = Math.max(categoriesEn.length, categoriesSr.length);
          const categoryIds: string[] = [];

          for (let i = 0; i < maxCategories; i++) {
            const nameEn = categoriesEn[i];
            const nameSr = categoriesSr[i];

            if (!nameEn) continue;

            const slug = generateSlug(nameEn);
            let category = await storage.getLocalizedCategoryBySlug(slug, 'en');

            if (!category) {
               const translations = [];
               translations.push({
                 languageCode: 'en',
                 name: nameEn,
                 slug,
                 description: null
               });

               if (nameSr) {
                 translations.push({
                   languageCode: 'sr-Latn',
                   name: nameSr,
                   slug, 
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
                    slug,
                    description: null
                  }).catch(() => {}); 
               } catch (e) {
                 // Ignore
               }
            }
            categoryIds.push(category.id);
          }

          if (categoryIds.length > 0) {
            await storage.removeVideoCategories(video.id);
            for (const categoryId of categoryIds) {
              await storage.addVideoCategory(video.id, categoryId);
              categoriesGenerated++;
            }
          }
        }

        if (type === "all" || type === "tags") {
          const tagsEn = categorizeResult.tags.en || [];
          const tagsSr = categorizeResult.tags.sr || [];
          const maxTags = Math.max(tagsEn.length, tagsSr.length);

          if (maxTags > 0) {
            await storage.deleteTagsByVideoId(video.id);
            
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

              await storage.createTag({ videoId: video.id }, translations);
              tagsGenerated++;
            }
          }
        }

        processed++;
        console.log(`[admin] regenerate processed video=${video.id} in ${Date.now() - startedAt}ms`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[admin] Error regenerating video ${video.id}:`, error);
        if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("aborted")) {
          console.warn(`[admin] regenerate timed out for video=${video.id}`);
        }
      }
    }

    const { cache: cacheModule } = await import("../cache.js");
    cacheModule.clear();

    const done = mode === "missing" ? total === 0 : nextOffset >= total;

    res.json({
      success: true,
      processed,
      categoriesGenerated,
      tagsGenerated,
      total,
      offset,
      limit,
      nextOffset,
      done,
    });
  } catch (error) {
    console.error("Regeneration error:", error);
    res.status(500).json({ error: "Failed to regenerate content" });
  }
});

router.post("/videos/:id/generate-summary", requireAuth, async (req, res) => {
  try {
    const video = await storage.getVideo(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const summary = await generateVideoSummary(video.title, video.description || "");
    
    // Optionally save the summary if we add a field for it, for now just return it
    // Or append it to description? Let's just return it for the UI to handle
    res.json({ success: true, summary });
  } catch (error) {
    console.error("Generate summary error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

router.post("/videos/:id/generate-seo", requireAuth, async (req, res) => {
  try {
    const video = await storage.getVideo(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const seoData = await generateSeoMetadata(video.title, video.description || "");
    res.json({ success: true, seoData });
  } catch (error) {
    console.error("Generate SEO error:", error);
    res.status(500).json({ error: "Failed to generate SEO metadata" });
  }
});

router.post("/regenerate-slugs", requireAuth, async (req, res) => {
  try {
    const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10) || 0);
    const limit = Math.min(
      200,
      Math.max(1, parseInt((req.query.limit as string) || "200", 10) || 200),
    );

    const allVideos = await storage.getAllVideos();
    const existingSlugs: string[] = [];
    for (const video of allVideos) {
      if (video.slug) existingSlugs.push(video.slug);
    }

    const mode = (req.query.mode as string) || "all";
    let targetVideos = allVideos;
    if (mode === "missing") {
      targetVideos = allVideos.filter((v) => !v.slug || v.slug.trim() === "");
    }

    const total = targetVideos.length;
    let processed = 0;

    let batch;
    let nextOffset;

    if (mode === "missing") {
      batch = targetVideos.slice(0, limit);
      nextOffset = 0;
    } else {
      batch = targetVideos.slice(offset, offset + limit);
      nextOffset = Math.min(total, offset + limit);
    }

    for (const video of batch) {
      try {
        const baseSlug = generateSlug(video.title);
        const newSlug = ensureUniqueSlug(baseSlug, existingSlugs);

        if (newSlug !== video.slug) {
          await storage.updateVideo(video.id, { slug: newSlug });
          existingSlugs.push(newSlug);
          processed++;
        }
      } catch (error) {
        console.error(`Error regenerating slug for video ${video.id}:`, error);
      }
    }

    const { cache: cacheModule } = await import("../cache.js");
    cacheModule.clear();

    const done = mode === "missing" ? total === 0 : nextOffset >= total;

    res.json({
      success: true,
      processed,
      total,
      offset,
      limit,
      nextOffset,
      done,
      message: `Successfully regenerated ${processed} video URLs`,
    });
  } catch (error) {
    console.error("Slug regeneration error:", error);
    res.status(500).json({ error: "Failed to regenerate slugs" });
  }
});

router.get("/cache/stats", requireAuth, async (req, res) => {
  try {
    const { cache: cacheModule } = await import("../cache.js");
    const stats = cacheModule.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Get cache stats error:", error);
    res.status(500).json({ error: "Failed to get cache statistics" });
  }
});

router.get("/performance/summary", requireAuth, async (_req, res) => {
  try {
    res.json(getPerformanceSummary());
  } catch (error) {
    console.error("Get performance summary error:", error);
    res.status(500).json({ error: "Failed to get performance summary" });
  }
});

router.post("/cache/clear", requireAuth, async (req, res) => {
  try {
    const { cache: cacheModule } = await import("../cache.js");
    cacheModule.clear();
    res.json({ success: true, message: "Cache cleared successfully" });
  } catch (error) {
    console.error("Clear cache error:", error);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

router.get("/cache/settings", requireAuth, async (req, res) => {
  try {
    const settings = await storage.getSystemSettings();
    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }
    res.json({
      cacheEnabled: settings.cacheEnabled === 1,
      cacheVideosTTL: settings.cacheVideosTTL,
      cacheChannelsTTL: settings.cacheChannelsTTL,
      cacheCategoriesTTL: settings.cacheCategoriesTTL,
      cacheApiTTL: settings.cacheApiTTL,
    });
  } catch (error) {
    console.error("Get cache settings error:", error);
    res.status(500).json({ error: "Failed to get cache settings" });
  }
});

router.put("/cache/settings", requireAuth, async (req, res) => {
  try {
    const {
      cacheEnabled,
      cacheVideosTTL,
      cacheChannelsTTL,
      cacheCategoriesTTL,
      cacheApiTTL,
    } = req.body;

    const updateData: any = { updatedAt: new Date() };

    if (cacheEnabled !== undefined) {
      updateData.cacheEnabled = cacheEnabled ? 1 : 0;
      const { cache: cacheModule } = await import("../cache.js");
      cacheModule.setEnabled(cacheEnabled);
    }
    if (cacheVideosTTL !== undefined) updateData.cacheVideosTTL = cacheVideosTTL;
    if (cacheChannelsTTL !== undefined)
      updateData.cacheChannelsTTL = cacheChannelsTTL;
    if (cacheCategoriesTTL !== undefined)
      updateData.cacheCategoriesTTL = cacheCategoriesTTL;
    if (cacheApiTTL !== undefined) updateData.cacheApiTTL = cacheApiTTL;

    await storage.updateSystemSettings(updateData);

    res.json({ success: true, message: "Cache settings updated successfully" });
  } catch (error) {
    console.error("Update cache settings error:", error);
    res.status(500).json({ error: "Failed to update cache settings" });
  }
});

router.get("/kv/stats", requireAuth, async (req, res) => {
  try {
    const stats = await kvService.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Get KV stats error:", error);
    res.status(500).json({ error: "Failed to get KV store statistics" });
  }
});

router.post("/kv/flush-buffers", requireAuth, async (req, res) => {
  try {
    const flushed = await kvService.flushAllViewBuffers();
    res.json({
      success: true,
      message: `Flushed ${flushed} view buffer${flushed !== 1 ? "s" : ""}`,
      flushed,
    });
  } catch (error) {
    console.error("Flush buffers error:", error);
    res.status(500).json({ error: "Failed to flush view buffers" });
  }
});

router.post("/kv/cleanup", requireAuth, async (req, res) => {
  try {
    const cleaned = await kvService.cleanupRateLimits();
    res.json({
      success: true,
      message: `Cleaned ${cleaned} expired rate limit${cleaned !== 1 ? "s" : ""}`,
      cleaned,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: "Failed to cleanup KV store" });
  }
});

router.get("/tags", requireAuth, async (_req, res) => {
  try {
    const allTags = await db
      .select({
        videoId: tags.videoId,
        tagName: tagTranslations.tagName,
      })
      .from(tags)
      .innerJoin(tagTranslations, eq(tags.id, tagTranslations.tagId))
      .where(eq(tagTranslations.languageCode, "en"));

    const tagCounts = allTags.reduce<
      Record<string, { tagName: string; count: number; videoIds: string[] }>
    >((acc, tag) => {
      if (!acc[tag.tagName]) {
        acc[tag.tagName] = { tagName: tag.tagName, count: 0, videoIds: [] };
      }
      acc[tag.tagName].count++;
      acc[tag.tagName].videoIds.push(tag.videoId);
      return acc;
    }, {});

    res.json(Object.values(tagCounts));
  } catch (error) {
    console.error("Error fetching admin tags:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

router.post("/tags/:tagName/generate-image", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const decodedTagName = decodeURIComponent(tagName);
    
    // Note: OpenAI image generation is removed/mocked in ai-service
    // We return a placeholder or handle gracefully
    
    return res.status(501).json({ 
      error: "AI Image generation is currently disabled. Please use manual upload." 
    });
    
    /* 
    // Legacy OpenAI code removed
    const response = await openai.images.generate({ ... });
    */
  } catch (error) {
    console.error("Error generating tag image:", error);
    res.status(500).json({ error: "Failed to generate tag image" });
  }
});

router.post("/tags/:tagName/image", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const { imageUrl } = req.body;
    const decodedTagName = decodeURIComponent(tagName);
    
    if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required" });
    }

    let normalizedPath = imageUrl;
    try {
      const objectStorageService = new ObjectStorageService();
      normalizedPath = objectStorageService.normalizeObjectEntityPath(imageUrl);
    } catch {
      normalizedPath = imageUrl;
    }

    const result = await storage.updateTagImage({
      tagName: decodedTagName,
      imageUrl: normalizedPath,
      isAiGenerated: 0,
    });

    res.json(result);
  } catch (error) {
    console.error("Error saving tag image:", error);
    res.status(500).json({ error: "Failed to save tag image" });
  }
});

router.delete("/tags/:tagName/image", requireAuth, async (req, res) => {
  try {
    const { tagName } = req.params;
    const decodedTagName = decodeURIComponent(tagName);
    await storage.deleteTagImage(decodedTagName);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag image:", error);
    res.status(500).json({ error: "Failed to delete tag image" });
  }
});

// Hero Management Routes
router.get("/hero", requireAuth, async (_req, res) => {
  try {
    const heroVideos = await storage.getHeroVideos();
    res.json(heroVideos);
  } catch (error) {
    console.error("Error fetching hero videos:", error);
    res.status(500).json({ error: "Failed to fetch hero videos" });
  }
});

router.post("/hero", requireAuth, async (req, res) => {
  try {
    const heroVideos = z.array(insertHeroVideoSchema).parse(req.body);
    const updated = await storage.updateHeroVideos(heroVideos);
    res.json({ success: true, heroVideos: updated });
  } catch (error: any) {
    console.error("Error updating hero videos:", error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({ 
      error: error.message || "Failed to update hero videos",
      details: error instanceof z.ZodError ? error.errors : undefined
    });
  }
});

// Hero Config Routes
router.get("/hero/config", requireAuth, async (_req, res) => {
  try {
    const settings = await storage.getHeroSettings();
    res.json(settings || { 
      fallbackImages: [], 
      rotationInterval: 4000, 
      animationType: 'fade', 
      defaultPlaceholderUrl: '', 
      enableRandom: true, 
      enableImages: true 
    });
  } catch (error) {
    console.error("Error fetching hero config:", error);
    res.status(500).json({ error: "Failed to fetch hero config" });
  }
});

router.post("/hero/config", requireAuth, async (req, res) => {
  try {
    const data = insertHeroSettingsSchema.partial().parse(req.body);
    const updated = await storage.updateHeroSettings(data);
    res.json({ success: true, settings: updated });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating hero config:", errorMessage);
    res.status(error instanceof z.ZodError ? 400 : 500).json({ 
      error: errorMessage || "Failed to update hero config",
      details: error instanceof z.ZodError ? error.errors : undefined
    });
  }
});

// Hero Images Routes
router.get("/hero/images", requireAuth, async (_req, res) => {
  try {
    const images = await storage.getHeroImages();
    res.json(images);
  } catch (error) {
    console.error("Error fetching hero images:", error);
    res.status(500).json({ error: "Failed to fetch hero images" });
  }
});

router.post("/hero/images", requireAuth, async (req, res) => {
  try {
    const images = z.array(insertHeroImageSchema).parse(req.body);
    const results = await Promise.all(images.map((img) => storage.upsertHeroImage(img)));
    res.json({ success: true, images: results });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating hero images:", errorMessage);
    res.status(error instanceof z.ZodError ? 400 : 500).json({ 
      error: errorMessage || "Failed to update hero images",
      details: error instanceof z.ZodError ? error.errors : undefined
    });
  }
});

// Analytics Settings Routes
router.get("/analytics/settings", requireAuth, async (req, res) => {
  try {
    const settings = await storage.getSystemSettings();
    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }
    res.json({
      gtmId: settings.gtmId,
      ga4Id: settings.ga4Id,
      customHeadCode: settings.customHeadCode,
      customBodyStartCode: settings.customBodyStartCode,
      customBodyEndCode: settings.customBodyEndCode,
    });
  } catch (error) {
    console.error("Error fetching analytics settings:", error);
    res.status(500).json({ error: "Failed to fetch analytics settings" });
  }
});

router.put("/analytics/settings", requireAuth, async (req, res) => {
  try {
    const { gtmId, ga4Id, customHeadCode, customBodyStartCode, customBodyEndCode } = req.body;
    
    await storage.updateSystemSettings({
      gtmId,
      ga4Id,
      customHeadCode,
      customBodyStartCode,
      customBodyEndCode,
      updatedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating analytics settings:", error);
    res.status(500).json({ error: "Failed to update analytics settings" });
  }
});

// Analytics Events Routes
router.get("/analytics/events", requireAuth, async (req, res) => {
  try {
    const events = await storage.getAnalyticsEvents();
    res.json(events);
  } catch (error) {
    console.error("Error fetching analytics events:", error);
    res.status(500).json({ error: "Failed to fetch analytics events" });
  }
});

router.post("/analytics/events", requireAuth, async (req, res) => {
  try {
    const eventData = insertAnalyticsEventSchema.parse(req.body);
    const event = await storage.createAnalyticsEvent(eventData);
    res.json(event);
  } catch (error: any) {
    console.error("Error creating analytics event:", error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({ 
      error: error.message || "Failed to create analytics event",
      details: error instanceof z.ZodError ? error.errors : undefined
    });
  }
});

router.put("/analytics/events/:id", requireAuth, async (req, res) => {
  try {
    const eventData = insertAnalyticsEventSchema.partial().parse(req.body);
    const event = await storage.updateAnalyticsEvent(req.params.id, eventData);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error: any) {
    console.error("Error updating analytics event:", error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({ 
      error: error.message || "Failed to update analytics event",
      details: error instanceof z.ZodError ? error.errors : undefined
    });
  }
});

router.delete("/analytics/events/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteAnalyticsEvent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting analytics event:", error);
    res.status(500).json({ error: "Failed to delete analytics event" });
  }
});

router.get("/debug/system-health", requireAuth, async (req, res) => {
  try {
    // 1. DB Status
    let dbStatus = "connected";
    try {
      await db.execute(sql`SELECT 1`);
    } catch (e) {
      dbStatus = "disconnected";
    }

    // 2. Recent Critical Errors (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const criticalErrors = await listErrorEvents({
      level: "critical",
      from: oneHourAgo,
      limit: 100
    });
    
    // 3. Cache Stats
    const { cache: cacheModule } = await import("../cache.js");
    const cacheStats = cacheModule.getStats();

    // 4. Memory
    const memory = process.memoryUsage();

    res.json({
      database: dbStatus,
      criticalErrorsLastHour: criticalErrors.items.length,
      cache: {
        keys: cacheStats.keys,
        hits: cacheStats.hits,
        misses: cacheStats.misses
      },
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024) + "MB",
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + "MB"
      },
      uptime: Math.round(process.uptime()) + "s"
    });
  } catch (error) {
    console.error("System health check failed", error);
    res.status(500).json({ error: "Health check failed" });
  }
});

export default router;
