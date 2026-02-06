import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth } from "../middleware/auth.js";
import { insertCategoryTranslationSchema } from "../../shared/schema.js";

const router = Router();

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
      transList = transList.map((t: any) => insertCategoryTranslationSchema.parse(t));
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

    const category = await storage.createCategory({}, transList);
    res.json(category);
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
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
