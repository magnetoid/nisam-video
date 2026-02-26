import { Router } from "express";
import { db } from "../db.js";
import { tagImages } from "../../shared/schema.js";

const router = Router();

router.get("/tag-images", async (_req, res) => {
  try {
    const images = await db.select().from(tagImages);
    res.json(images);
  } catch (error) {
    console.error("Error fetching tag images:", error);
    res.status(500).json({ error: "Failed to fetch tag images" });
  }
});

export default router;

