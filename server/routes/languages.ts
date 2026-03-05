import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { insertSupportedLanguageSchema, insertUiTranslationSchema } from "../../shared/schema.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    
    // 1. Load file-based translation if exists (as base)
    let fileData = {};
    try {
      // Adjust path to point to client/src/i18n/locales
      // Current file is server/routes/languages.ts -> ../../client/src/i18n/locales
      const localePath = path.resolve(__dirname, "../../client/src/i18n/locales", `${lng}.json`);
      const content = await fs.readFile(localePath, "utf-8");
      fileData = JSON.parse(content);
    } catch (e) {
      // File might not exist for new languages, that's fine
    }

    // 2. Load DB overrides
    const dbDataFlat = await storage.getUiTranslations(lng, ns);
    
    // 3. Unflatten DB keys (e.g. "nav.home" -> { nav: { home: "..." } })
    const dbDataNested: Record<string, any> = {};
    for (const [key, value] of Object.entries(dbDataFlat)) {
        const parts = key.split('.');
        let current = dbDataNested;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = value;
            } else {
                current[part] = current[part] || {};
                current = current[part];
            }
        }
    }

    // 4. Merge (DB wins)
    // Deep merge helper
    const deepMerge = (target: any, source: any) => {
        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    };

    // Note: lodash.merge is better, but trying to avoid extra deps if possible.
    // Actually, let's just use a simple spread for top level, or a basic deep merge.
    // Since we unflattened, we can try to merge.
    // For simplicity: We will send the fileData, then overlay the dbData.
    // But since keys are flattened in DB, we need to carefully merge.
    
    // Actually, i18next can handle flat JSON if configured, but let's stick to nested.
    // Using a library like 'lodash-es' would be safer, but I'll use a custom deepMerge.
    
    function isObject(item: any) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
    
    function mergeDeep(target: any, source: any) {
        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        return target;
    }

    const merged = mergeDeep(fileData, dbDataNested);
    res.json(merged);

  } catch (error) {
    console.error("Error fetching locales:", error);
    res.status(500).json({ error: "Failed to fetch locales" });
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
        
        // 1. Load file-based translation if exists
        let fileData: Record<string, any> = {};
        try {
            const localePath = path.resolve(__dirname, "../../client/src/i18n/locales", `${lng}.json`);
            const content = await fs.readFile(localePath, "utf-8");
            fileData = JSON.parse(content);
        } catch (e) {
            // File might not exist
            if (lng !== 'en') {
                // If not English, try loading English keys as base for structure? 
                // No, we want to see what is defined for THIS language.
                // But for the "Template" purpose in frontend, we fetch 'en'.
                // If 'en' file exists, we load it.
            }
        }

        // 2. Flatten file data
        const flatten = (obj: any, prefix = '', res: Record<string, string> = {}) => {
            for (const key in obj) {
                const val = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (val && typeof val === 'object') {
                    flatten(val, newKey, res);
                } else {
                    res[newKey] = String(val);
                }
            }
            return res;
        };
        const flatFile = flatten(fileData);

        // 3. Load DB overrides (already flat)
        const dbData = await storage.getUiTranslations(lng, 'translation');
        
        // 4. Merge (DB wins)
        const merged = { ...flatFile, ...dbData };
        
        res.json(merged);
    } catch (error) {
        console.error("Error fetching translations:", error);
        res.status(500).json({ error: "Failed to fetch translations" });
    }
});

export default router;
