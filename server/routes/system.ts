import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// System settings routes
router.get("/settings", async (req, res) => {
  try {
    const settings = await storage.getSystemSettings();
    if (settings) return res.json(settings);

    const created = await storage.updateSystemSettings({});
    return res.json(created);
  } catch (error) {
    console.error("Error fetching system settings:", error);
    // Return default settings on error to prevent app breakage
    res.json({
      id: "default",
      customHeadCode: "",
      customBodyStartCode: "",
      customBodyEndCode: "",
      siteTitle: "nisam.video",
      siteDescription: "AI-Powered Video Hub",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
});

router.patch("/settings", requireAuth, async (req, res) => {
  try {
    const updated = await storage.updateSystemSettings(req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating system settings:", error);
    res.status(500).json({ error: "Failed to update system settings" });
  }
});

export default router;
