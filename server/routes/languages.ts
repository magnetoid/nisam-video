import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { insertSupportedLanguageSchema, insertUiTranslationSchema } from "../../shared/schema.js";
import { z } from "zod";
import { getAllTranslationsFlat, getMergedTranslations } from "../services/languages.js";
import { translateContent } from "../services/translation-service.js";

const router = Router();

// --- Languages ---

// Get all supported languages
router.get("/languages", async (req, res) => {
  try {
    const langs = await storage.getSupportedLanguages();
    res.json(langs);
  } catch (error) {
    console.error("Error fetching languages:", error);
    res.status(500).json({ error: "Failed to fetch languages" });
  }
});

// Upsert a language (Admin only)
router.post("/languages", requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = insertSupportedLanguageSchema.parse(req.body);
    const result = await storage.upsertSupportedLanguage(data);
    res.json(result);
  } catch (error) {
    console.error("Error upserting language:", error);
    res.status(400).json({ error: "Invalid language data" });
  }
});

// Delete a language (Admin only)
router.delete("/languages/:code", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    if (code === 'en') {
        return res.status(400).json({ error: "Cannot delete default language" });
    }
    await storage.deleteSupportedLanguage(code);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting language:", error);
    res.status(500).json({ error: "Failed to delete language" });
  }
});

// --- Translations ---

// Get merged locales for i18next-http-backend
// Route: /api/locales/:lng/:ns
router.get("/locales/:lng/:ns", async (req, res) => {
  try {
    const { lng, ns } = req.params;
    const merged = await getMergedTranslations(lng, ns);
    res.json(merged);
  } catch (error) {
    console.error("Error fetching locales:", error);
    res.status(500).json({ error: "Failed to fetch locales" });
  }
});

// Auto-translate missing keys
router.post("/translate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { targetLang, sourceLang = "en" } = req.body;
    
    if (!targetLang) return res.status(400).json({ error: "Target language is required" });

    // 1. Get Source (English)
    const sourceTranslations = await getAllTranslationsFlat(sourceLang);
    
    // 2. Get Target
    const targetTranslations = await getAllTranslationsFlat(targetLang);
    
    // 3. Find missing keys
    const missingKeys: Record<string, string> = {};
    for (const [key, value] of Object.entries(sourceTranslations)) {
        if (!targetTranslations[key] || targetTranslations[key].trim() === "") {
            missingKeys[key] = value;
        }
    }

    if (Object.keys(missingKeys).length === 0) {
        return res.json({ message: "No missing translations found.", translated: 0 });
    }

    // 4. Batch translate (chunking to avoid context limits if necessary, assume small for now or handle simple)
    // For safety, let's limit to 50 keys per request or just do one batch if small.
    // If huge, we might timeout. Let's start with a hard limit of 50 for now and let user re-click.
    
    const BATCH_SIZE = 50;
    const keysToTranslate = Object.entries(missingKeys).slice(0, BATCH_SIZE);
    const batchPayload = Object.fromEntries(keysToTranslate);
    
    // 5. Call AI
    const translated = await translateContent(targetLang, batchPayload, sourceLang);
    
    // 6. Save results
    let savedCount = 0;
    for (const [key, value] of Object.entries(translated)) {
        await storage.upsertUiTranslation({
            languageCode: targetLang,
            namespace: "translation",
            key,
            value: String(value)
        });
        savedCount++;
    }

    res.json({ 
        message: `Translated ${savedCount} keys.`, 
        translated: savedCount,
        remaining: Object.keys(missingKeys).length - keysToTranslate.length
    });

  } catch (error: any) {
    console.error("Auto-translation error:", error);
    res.status(500).json({ error: error.message || "Translation failed" });
  }
});

// Update a translation key (Admin only)
router.post("/translations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = insertUiTranslationSchema.parse(req.body);
    const result = await storage.upsertUiTranslation(data);
    res.json(result);
  } catch (error) {
    console.error("Error updating translation:", error);
    res.status(400).json({ error: "Invalid translation data" });
  }
});

// Get flat translations for admin editor (Merged File + DB)
router.get("/translations/:lng", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { lng } = req.params;
        const merged = await getAllTranslationsFlat(lng);
        res.json(merged);
    } catch (error) {
        console.error("Error fetching translations:", error);
        res.status(500).json({ error: "Failed to fetch translations" });
    }
});

export default router;
