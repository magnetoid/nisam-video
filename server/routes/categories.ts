import { Router } from "express";
import { storage } from "../storage.js";
import { eq } from "drizzle-orm";

const router = Router();

function getLang(req: any): string {
  return req.query.lang || 'en';
}

// Categories
router.get("/", async (req, res) => {
  try {
    const lang = getLang(req);
    const categories = await storage.getAllLocalizedCategories(lang);
    res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const lang = getLang(req);
    const category = await storage.getLocalizedCategory(req.params.id, lang);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const lang = getLang(req);
    const category = await storage.getLocalizedCategoryBySlug(req.params.slug, lang);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    console.error("Get category by slug error:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

// Tags
router.get("/tags", async (req, res) => {
  try {
    const lang = getLang(req);
    const tags = await storage.getAllLocalizedTags(lang);
    res.json(tags);
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

router.get("/tags/:id", async (req, res) => {
  try {
    const lang = getLang(req);
    const tag = await storage.getLocalizedTag(req.params.id, lang);
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.json(tag);
  } catch (error) {
    console.error("Get tag error:", error);
    res.status(500).json({ error: "Failed to fetch tag" });
  }
});

router.get("/tags/name/:name", async (req, res) => {
  try {
    const lang = getLang(req);
    const tag = await storage.getLocalizedTagByName(req.params.name, lang);
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.json(tag);
  } catch (error) {
    console.error("Get tag by name error:", error);
    res.status(500).json({ error: "Failed to fetch tag" });
  }
});

export default router;
