import { Router } from "express";
import crypto from "crypto";
import { storage } from "../storage/index.js";
import { requireAdmin } from "../middleware/auth.js";
import { insertSeoSettingsSchema } from "../../shared/schema.js";
import { z } from "zod";
import { seoSettings, seoRedirects, seoMetaTags, seoKeywords, seoAuditLogs, seoABTests, seoCompetitors, videos } from "../../shared/schema.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db, isDbReady } from "../db.js";
import { generateSlug } from "../utils.js";
import { getAiConfig } from "../ai-service.js";
import { generateOpenAICompletion } from "../services/openai.js";
import { generateOllamaCompletion } from "../services/ollama.js";
import { clearCache, getCache, setCache } from "../services/redis.js";

const router = Router();

function isMissingRelationError(error: unknown) {
  const anyErr = error as any;
  const code = anyErr?.code;
  const message = anyErr?.message ? String(anyErr.message) : String(error);
  if (code === "42P01") return true;
  const msg = message.toLowerCase();
  return msg.includes("relation") && msg.includes("does not exist") && msg.includes("seo_");
}

function emptyPagination(page: number, limit: number) {
  return {
    page,
    limit,
    total: 0,
    totalPages: 0,
  };
}

router.get("/meta-tags", async (req, res) => {
  const { pageUrl } = req.query as { pageUrl?: string };
  if (!pageUrl) return res.json([]);
  if (!isDbReady()) return res.json([]);

  try {
    const tags = await db
      .select()
      .from(seoMetaTags)
      .where(and(eq(seoMetaTags.pageUrl, pageUrl), eq(seoMetaTags.isActive, true)))
      .orderBy(desc(seoMetaTags.createdAt))
      .limit(1);
    res.json(tags);
  } catch (error) {
    if (isMissingRelationError(error)) return res.json([]);
    console.warn("Get meta tags error:", error);
    res.json([]);
  }
});

// Enhanced SEO settings schema
const seoSettingsSchema = z.object({
  siteName: z.string().min(1).max(60).optional(),
  siteDescription: z.string().min(50).max(160).optional(),
  ogImage: z.string().url().optional(),
  twitterHandle: z.string().optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
  metaKeywords: z.string().optional(),
  googleSearchConsoleApiKey: z.string().optional(),
  bingWebmasterApiKey: z.string().optional(),
  enableAutoSitemapSubmission: z.boolean().optional(),
  enableSchemaMarkup: z.boolean().optional(),
  enableHreflang: z.boolean().optional(),
  enableABTesting: z.boolean().optional(),
  defaultLanguage: z.string().optional(),
  enableAMP: z.boolean().optional(),
  enablePWA: z.boolean().optional(),
  robotsTxt: z.string().optional(),
  enableLocalSEO: z.boolean().optional(),
  businessName: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional(),
  businessHours: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  siteLogoUrl: z.string().url().optional().or(z.literal("")),
  googleVerification: z.string().optional(),
  bingVerification: z.string().optional(),
  yandexVerification: z.string().optional(),
});

// Meta tag schema
const metaTagSchema = z.object({
  pageUrl: z.string().min(1),
  pageType: z.enum(["home", "video", "category", "tag", "custom"]),
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(1000),
  keywords: z.string().optional().nullable(),
  ogTitle: z.string().optional().nullable(),
  ogDescription: z.string().optional().nullable(),
  ogImage: z.string().optional().nullable(),
  twitterTitle: z.string().optional().nullable(),
  twitterDescription: z.string().optional().nullable(),
  twitterImage: z.string().optional().nullable(),
  canonicalUrl: z.string().optional().nullable(),
  schemaMarkup: z.any().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
});

// Redirect schema
const redirectSchema = z.object({
  fromUrl: z.string().min(1),
  toUrl: z.string().min(1),
  type: z.enum(["permanent", "temporary"]).optional(),
  isActive: z.boolean().optional(),
});

// Keyword schema
const keywordSchema = z.object({
  keyword: z.string().min(1),
  searchVolume: z.number().int().positive().optional(),
  competition: z.enum(["low", "medium", "high"]).optional(),
  difficulty: z.number().int().min(0).max(100).optional(),
  currentRank: z.number().int().positive().optional(),
  targetRank: z.number().int().positive().optional(),
});

// A/B test schema
const abTestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  elementType: z.enum(["title", "description", "og_title", "og_description"]),
  pageUrl: z.string().min(1),
  variantA: z.string().min(1),
  variantB: z.string().min(1),
  trafficSplit: z.number().int().min(10).max(90).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Competitor schema
const competitorSchema = z.object({
  domain: z.string().min(1),
  name: z.string().optional(),
  targetKeywords: z.array(z.string()).optional(),
  backlinks: z.number().int().positive().optional(),
  domainAuthority: z.number().int().min(0).max(100).optional(),
  organicTraffic: z.number().int().positive().optional(),
});

// Basic SEO settings routes
router.get("/settings", async (req, res) => {
  try {
    const settings = await storage.getSeoSettings();
    res.json(settings);
  } catch (error) {
    console.error("Get SEO settings error:", error);
    res.status(500).json({ error: "Failed to get SEO settings" });
  }
});

router.patch("/settings", requireAdmin, async (req, res) => {
  try {
    // Validate request body
    const validatedData = insertSeoSettingsSchema.partial().parse(req.body);
    const settings = await storage.updateSeoSettings(validatedData);
    res.json(settings);
  } catch (error) {
    console.error("Update SEO settings error:", error);
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: "Invalid SEO settings data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to update SEO settings" });
    }
  }
});

// Enhanced SEO settings routes
router.get("/enhanced/settings", async (req, res) => {
  try {
    const isAdmin = !!(req.session?.isAuthenticated && req.session?.role === "admin");
    const settings = await storage.getSeoSettings();
    
    // Get additional settings from enhanced table
    const enhancedSettings = await db.select().from(seoSettings).limit(1);
    
    if (enhancedSettings.length > 0) {
      const enhanced = enhancedSettings[0];
      res.json({
        ...settings,
        googleSearchConsoleApiKey: isAdmin ? enhanced.googleSearchConsoleApiKey : undefined,
        bingWebmasterApiKey: isAdmin ? enhanced.bingWebmasterApiKey : undefined,
        enableAutoSitemapSubmission: enhanced.enableAutoSitemapSubmission,
        enableSchemaMarkup: enhanced.enableSchemaMarkup,
        enableHreflang: enhanced.enableHreflang,
        enableABTesting: enhanced.enableABTesting,
        defaultLanguage: enhanced.defaultLanguage,
        enableAMP: enhanced.enableAMP,
        enablePWA: enhanced.enablePWA,
        robotsTxt: enhanced.robotsTxt,
        enableLocalSEO: enhanced.enableLocalSEO,
        businessName: enhanced.businessName,
        businessAddress: enhanced.businessAddress,
        businessPhone: enhanced.businessPhone,
        businessEmail: enhanced.businessEmail,
        businessHours: enhanced.businessHours,
        latitude: enhanced.latitude,
        longitude: enhanced.longitude,
        siteLogoUrl: (enhanced as any).siteLogoUrl,
        googleVerification: (enhanced as any).googleVerification,
        bingVerification: (enhanced as any).bingVerification,
        yandexVerification: (enhanced as any).yandexVerification,
      });
    } else {
      res.json(settings);
    }
  } catch (error) {
    if (isMissingRelationError(error)) {
      const settings = await storage.getSeoSettings().catch(() => null);
      return res.json(settings || {});
    }
    console.error("Get enhanced SEO settings error:", error);
    res.status(500).json({ error: "Failed to fetch SEO settings" });
  }
});

router.patch("/enhanced/settings", requireAdmin, async (req, res) => {
  try {
    const validatedData = seoSettingsSchema.parse(req.body);
    
    // Update base SEO settings
    await storage.updateSeoSettings(validatedData);
    
    // Update enhanced settings
    const existing = await db.select().from(seoSettings).limit(1);
    
    if (existing.length > 0) {
      await db.update(seoSettings)
        .set({ ...validatedData, updatedAt: sql`now()` })
        .where(eq(seoSettings.id, existing[0].id));
    } else {
      await db.insert(seoSettings).values({
        ...validatedData,
        id: crypto.randomUUID(),
        updatedAt: sql`now()`,
      });
    }
    
    const updatedSettings = await storage.getSeoSettings();
    res.json(updatedSettings);
  } catch (error) {
    console.error("Update enhanced SEO settings error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid SEO settings", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to update SEO settings" });
    }
  }
});

// Get meta tags with pagination and filtering
router.get("/enhanced/meta-tags", async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);

  if (!isDbReady()) {
    return res.json({
      metaTags: [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
      },
    });
  }

  try {
    const { pageType, isActive, search } = req.query;
    const offset = (safePage - 1) * safeLimit;
    
    let conditions: any[] = [];
    if (pageType) conditions.push(eq(seoMetaTags.pageType, pageType as any));
    if (isActive !== undefined) conditions.push(eq(seoMetaTags.isActive, isActive === "true"));
    if (search) {
      conditions.push(sql`${seoMetaTags.title} ILIKE ${`%${search}%`} OR ${seoMetaTags.pageUrl} ILIKE ${`%${search}%`}`);
    }
    
    const query = conditions.length > 0 
      ? db.select().from(seoMetaTags).where(and(...conditions))
      : db.select().from(seoMetaTags);
    
    const metaTags = await query
      .orderBy(desc(seoMetaTags.createdAt))
      .limit(safeLimit)
      .offset(offset);
    
    const totalCount = await db.select({ count: sql`count(*)` })
      .from(seoMetaTags)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number((totalCount as any)?.[0]?.count ?? 0);
    
    res.json({
      metaTags,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
      }
    });
  } catch (error: any) {
    if (error?.code === "42P01") {
      return res.json({
        metaTags: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    console.error("Get meta tags error:", error);
    res.status(500).json({ error: "Failed to fetch meta tags" });
  }
});

// Create meta tag
router.post("/enhanced/meta-tags", requireAdmin, async (req, res) => {
  try {
    const validatedData = metaTagSchema.parse(req.body);
    
    // Calculate SEO score
    const seoScore = calculateSEOScore(validatedData);
    
    const metaTag = await db.insert(seoMetaTags).values({
      ...validatedData,
      id: crypto.randomUUID(),
      seoScore,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    }).returning();
    
    res.json(metaTag[0]);
  } catch (error) {
    console.error("Create meta tag error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid meta tag data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create meta tag" });
    }
  }
});

// Update meta tag
router.patch("/enhanced/meta-tags/:id", requireAdmin, async (req, res) => {
  try {
    if (!isDbReady()) return res.status(503).json({ error: "Database not ready" });
    const { id } = req.params;
    const validatedData = z.object({
      pageUrl: z.string().optional(),
      pageType: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.string().optional(),
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
      ogImage: z.string().optional(),
      canonicalUrl: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const [existing] = await db.select().from(seoMetaTags).where(eq(seoMetaTags.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Meta tag not found", code: "NOT_FOUND" });

    const [updated] = await db.update(seoMetaTags)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(seoMetaTags.id, id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    console.error("Update meta tag error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid meta tag data", details: error.errors, code: "VALIDATION_ERROR" });
    } else {
      res.status(500).json({ error: error.message || "Failed to update meta tag", code: "META_TAG_UPDATE_FAILED" });
    }
  }
});

// Delete meta tag
router.delete("/enhanced/meta-tags/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await (storage as any).deleteSeoMetaTag(id);
    if (!success) return res.status(404).json({ error: "Meta tag not found", code: "NOT_FOUND" });
    res.json({ success: true, message: "Meta tag deleted successfully" });
  } catch (error: any) {
    console.error("Delete meta tag error:", error);
    res.status(500).json({ error: error.message || "Failed to delete meta tag", code: "META_TAG_DELETE_FAILED" });
  }
});

// Bulk update meta tags
router.patch("/enhanced/meta-tags/bulk/update", requireAdmin, async (req, res) => {
  try {
    const { ids, updates } = req.body;
    
    if (!Array.isArray(ids) || !updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Invalid bulk update data" });
    }
    
    const validatedUpdates = metaTagSchema.partial().parse(updates);
    
    const results = await Promise.all(
      ids.map(async (id) => {
        const currentTag = await db.select().from(seoMetaTags).where(eq(seoMetaTags.id, id));
        if (currentTag.length === 0) return null;
        
        const updatedData = {
          ...currentTag[0],
          ...validatedUpdates,
          seoScore: calculateSEOScore({ ...currentTag[0], ...validatedUpdates }),
          updatedAt: sql`now()`,
        };
        
        const result = await db.update(seoMetaTags)
          .set(updatedData)
          .where(eq(seoMetaTags.id, id))
          .returning();
        
        return result[0];
      })
    );
    
    const updatedTags = results.filter(Boolean);
    res.json({ success: true, updated: updatedTags.length, metaTags: updatedTags });
  } catch (error) {
    console.error("Bulk update meta tags error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid bulk update data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to bulk update meta tags" });
    }
  }
});

// Generate AI SEO suggestions
router.post("/enhanced/meta-tags/suggest", requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Gather context from DB if possible
    let context = "Page URL: " + url;
    if (url.startsWith("/video/")) {
      const slug = url.split("/video/")[1];
      const [video] = await db.select().from(videos).where(eq(videos.slug, slug)).limit(1);
      if (video) {
        context += `\nVideo Title: ${video.title}\nVideo Description: ${video.description}`;
      }
    }

    const aiConfig = await getAiConfig();
    const systemPrompt = `You are an expert SEO specialist. Generate optimal meta title (max 60 chars), meta description (max 160 chars), and 5-10 comma-separated keywords based on the following page context. Output ONLY raw JSON format: {"title": "...", "description": "...", "keywords": "..."}`;
    
    let aiResponseText = "";
    if (aiConfig.provider === "openai" && aiConfig.openai.apiKey) {
      aiResponseText = await generateOpenAICompletion(
        aiConfig.openai.baseUrl!,
        aiConfig.openai.apiKey,
        aiConfig.openai.model,
        systemPrompt,
        context
      );
    } else if (aiConfig.provider === "ollama") {
      aiResponseText = await generateOllamaCompletion(
        aiConfig.ollama.url,
        aiConfig.ollama.model,
        systemPrompt,
        context
      );
    } else {
      return res.status(400).json({ error: "AI provider not configured properly." });
    }

    // Clean markdown formatting if present
    const cleanJson = aiResponseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    res.json(parsed);
  } catch (error: any) {
    console.error("Generate SEO suggestions error:", error);
    res.status(500).json({ error: "Failed to generate AI suggestions" });
  }
});

// Get redirects with pagination and filtering
router.get("/enhanced/redirects", async (req, res) => {
  try {
    const { page = 1, limit = 50, type, isActive, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let conditions: any[] = [];
    if (type) conditions.push(eq(seoRedirects.type, type as string));
    if (isActive !== undefined) conditions.push(eq(seoRedirects.isActive, isActive === "true"));
    if (search) {
      conditions.push(sql`${seoRedirects.fromUrl} ILIKE ${`%${search}%`} OR ${seoRedirects.toUrl} ILIKE ${`%${search}%`}`);
    }
    
    const query = conditions.length > 0 
      ? db.select().from(seoRedirects).where(and(...conditions))
      : db.select().from(seoRedirects);
    
    const redirects = await query
      .orderBy(desc(seoRedirects.createdAt))
      .limit(Number(limit))
      .offset(offset);
    
    const totalCount = await db.select({ count: sql`count(*)` })
      .from(seoRedirects)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      redirects,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount[0].count),
        totalPages: Math.ceil(Number(totalCount[0].count) / Number(limit))
      }
    });
  } catch (error) {
    const safeLimit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const safePage = Math.max(1, Number(req.query.page) || 1);
    if (isMissingRelationError(error)) {
      return res.json({ redirects: [], pagination: emptyPagination(safePage, safeLimit) });
    }
    console.error("Get redirects error:", error);
    res.status(500).json({ error: "Failed to fetch redirects" });
  }
});

// Create redirect
router.post("/enhanced/redirects", requireAdmin, async (req, res) => {
  try {
    const validatedData = redirectSchema.parse(req.body);
    
    const redirect = await db.insert(seoRedirects).values({
      ...validatedData,
      id: crypto.randomUUID(),
      hits: 0,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    }).returning();
    
    res.json(redirect[0]);
  } catch (error) {
    console.error("Create redirect error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid redirect data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create redirect" });
    }
  }
});

// Update redirect
router.patch("/enhanced/redirects/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = redirectSchema.partial().parse(req.body);
    
    const updatedRedirect = await db.update(seoRedirects)
      .set({ ...validatedData, updatedAt: sql`now()` })
      .where(eq(seoRedirects.id, id))
      .returning();
    
    if (updatedRedirect.length === 0) {
      return res.status(404).json({ error: "Redirect not found" });
    }
    
    res.json(updatedRedirect[0]);
  } catch (error) {
    console.error("Update redirect error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid redirect data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to update redirect" });
    }
  }
});

// Delete redirect
router.delete("/enhanced/redirects/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.delete(seoRedirects).where(eq(seoRedirects.id, id));
    
    res.json({ success: true, message: "Redirect deleted successfully" });
  } catch (error) {
    console.error("Delete redirect error:", error);
    res.status(500).json({ error: "Failed to delete redirect" });
  }
});

// Get keywords with pagination and filtering
router.get("/enhanced/keywords", async (req, res) => {
  try {
    const { page = 1, limit = 50, competition, search, sortBy = "keyword" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let conditions: any[] = [];
    if (competition) conditions.push(eq(seoKeywords.competition, competition as string));
    if (search) {
      conditions.push(sql`${seoKeywords.keyword} ILIKE ${`%${search}%`}`);
    }
    
    const query = conditions.length > 0 
      ? db.select().from(seoKeywords).where(and(...conditions))
      : db.select().from(seoKeywords);
    
    // Apply sorting
    let orderedQuery = query;
    if (sortBy === "keyword") {
      orderedQuery = query.orderBy(asc(seoKeywords.keyword));
    } else if (sortBy === "searchVolume") {
      orderedQuery = query.orderBy(desc(seoKeywords.searchVolume));
    } else if (sortBy === "currentRank") {
      orderedQuery = query.orderBy(asc(seoKeywords.currentRank));
    } else if (sortBy === "difficulty") {
      orderedQuery = query.orderBy(desc(seoKeywords.difficulty));
    }
    
    const keywords = await orderedQuery
      .limit(Number(limit))
      .offset(offset);
    
    const totalCount = await db.select({ count: sql`count(*)` })
      .from(seoKeywords)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      keywords,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount[0].count),
        totalPages: Math.ceil(Number(totalCount[0].count) / Number(limit))
      }
    });
  } catch (error) {
    const safeLimit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const safePage = Math.max(1, Number(req.query.page) || 1);
    if (isMissingRelationError(error)) {
      return res.json({ keywords: [], pagination: emptyPagination(safePage, safeLimit) });
    }
    console.error("Get keywords error:", error);
    res.status(500).json({ error: "Failed to fetch keywords" });
  }
});

// Create keyword
router.post("/enhanced/keywords", requireAdmin, async (req, res) => {
  try {
    const validatedData = keywordSchema.parse(req.body);
    
    const keyword = await db.insert(seoKeywords).values({
      ...validatedData,
      id: crypto.randomUUID(),
      clicks: 0,
      impressions: 0,
      ctr: 0,
      lastUpdated: sql`now()`,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    }).returning();
    
    res.json(keyword[0]);
  } catch (error) {
    console.error("Create keyword error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid keyword data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create keyword" });
    }
  }
});

// Update keyword
router.patch("/enhanced/keywords/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = keywordSchema.partial().parse(req.body);
    
    const updatedKeyword = await db.update(seoKeywords)
      .set({ ...validatedData, updatedAt: sql`now()` })
      .where(eq(seoKeywords.id, id))
      .returning();
    
    if (updatedKeyword.length === 0) {
      return res.status(404).json({ error: "Keyword not found" });
    }
    
    res.json(updatedKeyword[0]);
  } catch (error) {
    console.error("Update keyword error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid keyword data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to update keyword" });
    }
  }
});

// Delete keyword
router.delete("/enhanced/keywords/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.delete(seoKeywords).where(eq(seoKeywords.id, id));
    
    res.json({ success: true, message: "Keyword deleted successfully" });
  } catch (error) {
    console.error("Delete keyword error:", error);
    res.status(500).json({ error: "Failed to delete keyword" });
  }
});

// Get audit results
router.get("/enhanced/audits", async (req, res) => {
  try {
    const { page = 1, limit = 50, auditType, pageUrl } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let conditions: any[] = [];
    if (auditType) conditions.push(eq(seoAuditLogs.auditType, auditType as string));
    if (pageUrl) conditions.push(eq(seoAuditLogs.pageUrl, pageUrl as string));
    
    const query = conditions.length > 0 
      ? db.select().from(seoAuditLogs).where(and(...conditions))
      : db.select().from(seoAuditLogs);
    
    const audits = await query
      .orderBy(desc(seoAuditLogs.createdAt))
      .limit(Number(limit))
      .offset(offset);
    
    const totalCount = await db.select({ count: sql`count(*)` })
      .from(seoAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      audits,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount[0].count),
        totalPages: Math.ceil(Number(totalCount[0].count) / Number(limit))
      }
    });
  } catch (error) {
    const safeLimit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const safePage = Math.max(1, Number(req.query.page) || 1);
    if (isMissingRelationError(error)) {
      return res.json({ audits: [], pagination: emptyPagination(safePage, safeLimit) });
    }
    console.error("Get audits error:", error);
    res.status(500).json({ error: "Failed to fetch audits" });
  }
});

// Create audit (run SEO audit)
router.post("/enhanced/audits", requireAdmin, async (req, res) => {
  try {
    const { pageUrl } = req.body;
    
    if (!pageUrl) {
      return res.status(400).json({ error: "Page URL is required" });
    }
    
    // Run comprehensive SEO audit
    const auditResult = await runSEOAudit(pageUrl);
    
    const audit = await db.insert(seoAuditLogs).values({
      ...auditResult,
      id: crypto.randomUUID(),
      createdAt: sql`now()`,
    }).returning();
    
    res.json(audit[0]);
  } catch (error) {
    console.error("Create audit error:", error);
    res.status(500).json({ error: "Failed to create audit" });
  }
});

// Get A/B tests
router.get("/enhanced/ab-tests", async (req, res) => {
  try {
    const { page = 1, limit = 50, status, elementType } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let conditions: any[] = [];
    if (status) conditions.push(eq(seoABTests.status, status as string));
    if (elementType) conditions.push(eq(seoABTests.elementType, elementType as string));
    
    const query = conditions.length > 0 
      ? db.select().from(seoABTests).where(and(...conditions))
      : db.select().from(seoABTests);
    
    const abTests = await query
      .orderBy(desc(seoABTests.createdAt))
      .limit(Number(limit))
      .offset(offset);
    
    const totalCount = await db.select({ count: sql`count(*)` })
      .from(seoABTests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      abTests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount[0].count),
        totalPages: Math.ceil(Number(totalCount[0].count) / Number(limit))
      }
    });
  } catch (error) {
    const safeLimit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const safePage = Math.max(1, Number(req.query.page) || 1);
    if (isMissingRelationError(error)) {
      return res.json({ abTests: [], pagination: emptyPagination(safePage, safeLimit) });
    }
    console.error("Get A/B tests error:", error);
    res.status(500).json({ error: "Failed to fetch A/B tests" });
  }
});

// Create A/B test
router.post("/enhanced/ab-tests", requireAdmin, async (req, res) => {
  try {
    const validatedData = abTestSchema.parse(req.body);
    
    const abTest = await db.insert(seoABTests).values({
      ...validatedData,
      id: crypto.randomUUID(),
      status: "draft",
      results: { variantA: { impressions: 0, clicks: 0, ctr: 0 }, variantB: { impressions: 0, clicks: 0, ctr: 0 } },
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    }).returning();
    
    res.json(abTest[0]);
  } catch (error) {
    console.error("Create A/B test error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid A/B test data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create A/B test" });
    }
  }
});

// Get competitors
router.get("/enhanced/competitors", async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let conditions: any[] = [];
    if (search) {
      conditions.push(sql`${seoCompetitors.domain} ILIKE ${`%${search}%`} OR ${seoCompetitors.name} ILIKE ${`%${search}%`}`);
    }
    
    const query = conditions.length > 0 
      ? db.select().from(seoCompetitors).where(and(...conditions))
      : db.select().from(seoCompetitors);
    
    const competitors = await query
      .orderBy(desc(seoCompetitors.createdAt))
      .limit(Number(limit))
      .offset(offset);
    
    const totalCount = await db.select({ count: sql`count(*)` })
      .from(seoCompetitors)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      competitors,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount[0].count),
        totalPages: Math.ceil(Number(totalCount[0].count) / Number(limit))
      }
    });
  } catch (error) {
    const safeLimit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const safePage = Math.max(1, Number(req.query.page) || 1);
    if (isMissingRelationError(error)) {
      return res.json({ competitors: [], pagination: emptyPagination(safePage, safeLimit) });
    }
    console.error("Get competitors error:", error);
    res.status(500).json({ error: "Failed to fetch competitors" });
  }
});

// Create competitor
router.post("/enhanced/competitors", requireAdmin, async (req, res) => {
  try {
    const validatedData = competitorSchema.parse(req.body);
    
    const competitor = await db.insert(seoCompetitors).values({
      ...validatedData,
      id: crypto.randomUUID(),
      lastAnalyzed: sql`now()`,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    }).returning();
    
    res.json(competitor[0]);
  } catch (error) {
    console.error("Create competitor error:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid competitor data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create competitor" });
    }
  }
});

// Generate XML sitemap
router.get("/enhanced/sitemap", async (req, res) => {
  try {
    const baseUrl = "https://nisam.video";
    const lang = typeof req.query.lang === "string" ? req.query.lang : "en";
    const includeVideos = String(req.query.includeVideos ?? "1") !== "0";
    const includeCategories = String(req.query.includeCategories ?? "1") !== "0";
    const includeTags = String(req.query.includeTags ?? "1") !== "0";
    const includeChannels = String(req.query.includeChannels ?? "1") !== "0";
    const maxVideosRaw = typeof req.query.maxVideos === "string" ? req.query.maxVideos : "";
    const maxVideos = Number.isFinite(parseInt(maxVideosRaw || "", 10)) ? Math.max(0, parseInt(maxVideosRaw, 10)) : 0;

    const cacheKey = `sitemap:xml:enhanced:${lang}:${includeVideos}:${includeCategories}:${includeTags}:${includeChannels}:${maxVideos}`;
    const cachedXml = await getCache<string>(cacheKey);
    if (cachedXml) {
      res.setHeader("Content-Type", "application/xml");
      return res.send(cachedXml);
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
    
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
    sitemap += 'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';
    
    // Add homepage
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
    
    // Add video pages
    for (const video of videos) {
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/video/${video.slug || video.id}</loc>\n`;
      sitemap += "    <changefreq>monthly</changefreq>\n";
      sitemap += "    <priority>0.8</priority>\n";
      
      if (video.createdAt) {
        sitemap += `    <lastmod>${new Date(video.createdAt).toISOString()}</lastmod>\n`;
      }
      
      sitemap += "    <video:video>\n";
      sitemap += `      <video:title>${escapeXml(video.title)}</video:title>\n`;
      if (video.description) {
        sitemap += `      <video:description>${escapeXml(video.description.substring(0, 2048))}</video:description>\n`;
      }
      sitemap += `      <video:content_loc>https://www.youtube.com/watch?v=${video.videoId}</video:content_loc>\n`;
      sitemap += `      <video:thumbnail_loc>${video.thumbnailUrl}</video:thumbnail_loc>\n`;
      sitemap += "    </video:video>\n";
      sitemap += "  </url>\n";
    }
    
    // Add category pages
    for (const category of categories) {
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/categories?filter=${category.id}</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.6</priority>\n";
      sitemap += "  </url>\n";
    }
    
    // Add tag pages
    for (const tag of tags) {
      sitemap += "  <url>\n";
      const tagSlug = encodeURIComponent(String(tag.tagName || "").trim().replace(/\s+/g, "-"));
      sitemap += `    <loc>${baseUrl}/tag/${tagSlug}</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.5</priority>\n";
      sitemap += "  </url>\n";
    }

    for (const channel of channels) {
      const slug = `${generateSlug(channel.name, 80)}-${channel.id}`;
      sitemap += "  <url>\n";
      sitemap += `    <loc>${baseUrl}/channels/${slug}</loc>\n`;
      sitemap += "    <changefreq>weekly</changefreq>\n";
      sitemap += "    <priority>0.6</priority>\n";
      sitemap += "  </url>\n";
    }
    
    sitemap += "</urlset>";
    
    await setCache(cacheKey, sitemap, 3600);

    res.setHeader("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error) {
    console.error("Generate sitemap error:", error);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
});

// Regenerate sitemap (clear cache)
router.post("/enhanced/sitemap/regenerate", requireAdmin, async (req, res) => {
  try {
    await clearCache("sitemap:xml:*");
    res.json({ success: true, message: "Sitemap cache cleared successfully" });
  } catch (error) {
    console.error("Regenerate sitemap error:", error);
    res.status(500).json({ error: "Failed to regenerate sitemap" });
  }
});

// Get robots.txt content
router.get("/enhanced/robots-txt", async (req, res) => {
  try {
    const settings = await db.select().from(seoSettings).limit(1);
    
    let robotsTxt = "User-agent: *\n";
    robotsTxt += "Allow: /\n";
    robotsTxt += "Disallow: /admin/\n";
    robotsTxt += "Disallow: /api/\n";
    robotsTxt += "Disallow: /login\n";
    robotsTxt += "\n";
    robotsTxt += "Sitemap: https://nisam.video/sitemap.xml\n";
    
    if (settings.length > 0 && settings[0].robotsTxt) {
      robotsTxt = settings[0].robotsTxt;
    }
    
    res.setHeader("Content-Type", "text/plain");
    res.send(robotsTxt);
  } catch (error) {
    console.error("Get robots.txt error:", error);
    res.status(500).json({ error: "Failed to get robots.txt" });
  }
});

// Update robots.txt content
router.patch("/enhanced/robots-txt", requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Robots.txt content is required" });
    }
    
    const existing = await db.select().from(seoSettings).limit(1);
    
    if (existing.length > 0) {
      await db.update(seoSettings)
        .set({ robotsTxt: content, updatedAt: sql`now()` })
        .where(eq(seoSettings.id, existing[0].id));
    } else {
      await db.insert(seoSettings).values({
        id: crypto.randomUUID(),
        robotsTxt: content,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      });
    }
    
    res.json({ success: true, message: "Robots.txt updated successfully" });
  } catch (error) {
    console.error("Update robots.txt error:", error);
    res.status(500).json({ error: "Failed to update robots.txt" });
  }
});

// Helper functions
function calculateSEOScore(metaTag: any): number {
  let score = 0;
  
  // Title optimization (30 points)
  if (metaTag.title && metaTag.title.length >= 30 && metaTag.title.length <= 60) {
    score += 30;
  } else if (metaTag.title) {
    score += 15; // Partial points for having a title
  }
  
  // Description optimization (30 points)
  if (metaTag.description && metaTag.description.length >= 120 && metaTag.description.length <= 160) {
    score += 30;
  } else if (metaTag.description) {
    score += 15; // Partial points for having a description
  }
  
  // Open Graph optimization (20 points)
  if (metaTag.ogTitle && metaTag.ogDescription && metaTag.ogImage) {
    score += 20;
  } else if (metaTag.ogTitle || metaTag.ogDescription) {
    score += 10; // Partial points
  }
  
  // Twitter Card optimization (10 points)
  if (metaTag.twitterTitle && metaTag.twitterDescription) {
    score += 10;
  }
  
  // Canonical URL (10 points)
  if (metaTag.canonicalUrl) {
    score += 10;
  }
  
  return Math.min(score, 100); // Cap at 100
}

async function runSEOAudit(pageUrl: string): Promise<any> {
  const issues: { type: string; severity: "error" | "warning" | "info"; message: string; suggestion: string }[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check if page has meta tags configured
  try {
    if (isDbReady()) {
      const [metaTag] = await db.select().from(seoMetaTags)
        .where(eq(seoMetaTags.pageUrl, pageUrl)).limit(1);

      if (!metaTag) {
        issues.push({ type: "meta", severity: "warning", message: "No custom meta tags configured for this page", suggestion: "Add page-specific meta title and description" });
        score -= 15;
      } else {
        if (!metaTag.title || metaTag.title.length < 10) {
          issues.push({ type: "title", severity: "warning", message: "Meta title is missing or too short", suggestion: "Add a descriptive title between 30-60 characters" });
          score -= 10;
        } else if (metaTag.title.length > 60) {
          issues.push({ type: "title", severity: "info", message: "Meta title exceeds 60 characters and may be truncated in search results", suggestion: "Shorten your title to under 60 characters" });
          score -= 5;
        }

        if (!metaTag.description || metaTag.description.length < 50) {
          issues.push({ type: "description", severity: "warning", message: "Meta description is missing or too short", suggestion: "Add a compelling description between 120-160 characters" });
          score -= 10;
        } else if (metaTag.description.length > 160) {
          issues.push({ type: "description", severity: "info", message: "Meta description exceeds 160 characters", suggestion: "Trim description to under 160 characters" });
          score -= 5;
        }

        if (!metaTag.ogImage) {
          issues.push({ type: "og:image", severity: "warning", message: "Open Graph image is not set", suggestion: "Add an OG image (1200x630px recommended) for social sharing" });
          score -= 10;
        }

        if (!metaTag.canonicalUrl) {
          issues.push({ type: "canonical", severity: "info", message: "No canonical URL set", suggestion: "Set a canonical URL to prevent duplicate content issues" });
          score -= 5;
        }
      }
    }
  } catch {
    // DB not ready or table missing - skip meta check
  }

  if (issues.length === 0) {
    recommendations.push("All basic SEO checks passed. Consider adding structured data markup for rich snippets.");
  }
  recommendations.push("Ensure all images have descriptive alt text");
  recommendations.push("Verify page loads in under 3 seconds");

  return {
    auditType: "technical",
    pageUrl,
    score: Math.max(score, 0),
    issues,
    recommendations,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default router;
