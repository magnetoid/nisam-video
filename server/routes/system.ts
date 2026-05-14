import { Router } from "express";
import { storage } from "../storage/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function sanitizeSettings(settings: any, isAdmin: boolean) {
  if (isAdmin) return settings;
  const {
    turnstileSecretKey,
    youtubeApiKey,
    ...safeSettings
  } = settings || {};
  return safeSettings;
}

// System settings routes
router.get("/settings", async (req, res) => {
  try {
    const isAdmin = !!(req.session?.isAuthenticated && req.session?.role === "admin");
    const settings = await storage.getSystemSettings();
    if (settings) return res.json(sanitizeSettings(settings, isAdmin));

    const created = await storage.updateSystemSettings({});
    return res.json(sanitizeSettings(created, isAdmin));
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

// Public endpoint: returns only the Turnstile site key (no secrets)
router.get("/turnstile", async (req, res) => {
  try {
    const settings = await storage.getSystemSettings();
    if (settings?.turnstileEnabled && settings.turnstileSiteKey) {
      return res.json({ enabled: true, siteKey: settings.turnstileSiteKey });
    }
    res.json({ enabled: false });
  } catch {
    res.json({ enabled: false });
  }
});

router.patch("/settings", requireAdmin, async (req, res) => {
  try {
    const updated = await storage.updateSystemSettings(req.body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating system settings:", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Failed to update system settings", details: message });
  }
});

export default router;
