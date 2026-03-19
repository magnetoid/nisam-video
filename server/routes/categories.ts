import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { insertCategoryTranslationSchema } from "../../shared/schema.js";
import { z } from "zod";
import { translateContent } from "../services/translation-service.js";

const router = Router();

const createCategoryTranslationInputSchema = insertCategoryTranslationSchema.omit({
  categoryId: true,
});

// Category routes
router.get("/", async (req, res) => {
  try {
    const lang = (req.query.lang as string) || "en";
    const categories = await storage.getAllLocalizedCategories(lang);
    res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const lang = (req.query.lang as string) || "en";
    
    const category = await storage.getLocalizedCategoryBySlug(slug, lang);
    
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    res.json(category);
  } catch (error) {
    console.error("Get category by slug error:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

router.get("/admin/all", requireAuth, async (req, res) => {
  try {
    const categories = await storage.getAllCategoriesWithTranslations();
    res.json(categories);
  } catch (error) {
    console.error("Get admin categories error:", error);
    res.status(500).json({ error: "Failed to fetch admin categories" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, description, translations } = req.body;
    
    // Handle backward compatibility or simplified input
    let transList = translations;
    if (!transList && name) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      transList = [{ 
        languageCode: 'en', 
        name, 
        slug, 
        description: description || null 
      }];
    }

    if (!transList || !Array.isArray(transList) || transList.length === 0) {
      return res.status(400).json({ error: "Valid translations or name required" });
    }

    // Validate translations
    try {
      transList = transList.map((t: any) => createCategoryTranslationInputSchema.parse(t));
    } catch (e) {
      return res.status(400).json({ error: "Invalid translation data", details: e });
    }

    // Check if slug exists for the first translation (simple check)
    const firstTrans = transList[0];
    const existingCategory = await storage.getLocalizedCategoryBySlug(firstTrans.slug, firstTrans.languageCode);
    if (existingCategory) {
      return res
        .status(400)
        .json({ error: "Category with this name/slug already exists" });
    }

    // Auto-generate missing translations for active languages (best-effort)
    try {
      const supported = await storage.getSupportedLanguages();
      const active = supported.filter((l) => l.isActive);
      const existingLangs = new Set(transList.map((t: any) => t.languageCode));
      const sourceLang = firstTrans.languageCode || "en";

      for (const lang of active) {
        if (existingLangs.has(lang.code)) continue;

        const translated = await translateContent(
          lang.code,
          {
            name: firstTrans.name,
            description: firstTrans.description || "",
          },
          sourceLang,
        ).catch(() => null);

        if (!translated) continue;

        const translatedName = String((translated as any).name || "").trim();
        const translatedDescriptionRaw = (translated as any).description;
        const translatedDescription =
          typeof translatedDescriptionRaw === "string" && translatedDescriptionRaw.trim().length > 0
            ? translatedDescriptionRaw
            : null;

        if (!translatedName) continue;

        transList.push(
          createCategoryTranslationInputSchema.parse({
            languageCode: lang.code,
            name: translatedName,
            slug: firstTrans.slug,
            description: translatedDescription,
          }),
        );

        existingLangs.add(lang.code);
      }
    } catch {
    }

    const category = await storage.createCategory({}, transList);
    res.json(category);
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.post("/admin/translate-missing", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = z
      .object({
        targetLang: z.string().min(1),
        sourceLang: z.string().min(1).default("en"),
        limit: z.number().int().positive().max(200).default(50),
      })
      .parse(req.body);

    const all = await storage.getAllCategoriesWithTranslations();
    const candidates = all
      .map((c) => {
        const source = c.translations.find((t) => t.languageCode === body.sourceLang);
        if (!source) return null;
        const hasTarget = c.translations.some((t) => t.languageCode === body.targetLang);
        if (hasTarget) return null;
        return { categoryId: c.id, slug: source.slug, name: source.name, description: source.description || "" };
      })
      .filter(Boolean)
      .slice(0, body.limit) as Array<{ categoryId: string; slug: string; name: string; description: string }>;

    let translatedCount = 0;
    for (const item of candidates) {
      const translated = await translateContent(
        body.targetLang,
        { name: item.name, description: item.description },
        body.sourceLang,
      ).catch(() => null);
      if (!translated) continue;

      const translatedName = String((translated as any).name || "").trim();
      const translatedDescriptionRaw = (translated as any).description;
      const translatedDescription =
        typeof translatedDescriptionRaw === "string" && translatedDescriptionRaw.trim().length > 0
          ? translatedDescriptionRaw
          : null;

      if (!translatedName) continue;

      await storage.addCategoryTranslation(item.categoryId, {
        categoryId: item.categoryId,
        languageCode: body.targetLang,
        name: translatedName,
        slug: item.slug,
        description: translatedDescription,
      });
      translatedCount++;
    }

    res.json({ translated: translatedCount, remaining: Math.max(0, candidates.length - translatedCount) });
  } catch (error: any) {
    const raw = String(error?.message || "Translation failed");
    const sanitized = raw.replace(/sk-[^\s"']{8,}/g, "[redacted]");
    res.status(500).json({ error: sanitized });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, languageCode } = req.body;
    const lang = languageCode || 'en';

    const updateData: any = {};
    if (name) {
      updateData.name = name;
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    if (description !== undefined) {
      updateData.description = description;
    }

    const updated = await storage.updateLocalizedCategory(id, lang, updateData);
    if (!updated) {
      return res.status(404).json({ error: "Category translation not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteCategory(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
