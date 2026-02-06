import { Router } from "express";
import { scheduler } from "../scheduler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const settings = await scheduler.getSettings();
    const status = scheduler.getStatus();
    res.json({ ...settings, ...status });
  } catch (error) {
    console.error("Get scheduler error:", error);
    res.status(500).json({ error: "Failed to fetch scheduler status" });
  }
});

router.post("/start", requireAuth, async (req, res) => {
  try {
    await scheduler.start();
    const settings = await scheduler.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Start scheduler error:", error);
    res.status(500).json({ error: "Failed to start scheduler" });
  }
});

router.post("/stop", requireAuth, async (req, res) => {
  try {
    await scheduler.stop();
    const settings = await scheduler.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Stop scheduler error:", error);
    res.status(500).json({ error: "Failed to stop scheduler" });
  }
});

router.patch("/", requireAuth, async (req, res) => {
  try {
    const { intervalHours } = req.body;
    const settings = await scheduler.updateSettings({ intervalHours });

    // Restart if currently enabled
    if (settings.isEnabled) {
      await scheduler.stop();
      await scheduler.start();
    }

    res.json(settings);
  } catch (error) {
    console.error("Update scheduler error:", error);
    res.status(500).json({ error: "Failed to update scheduler" });
  }
});

router.post("/run-now", requireAuth, async (req, res) => {
  try {
    // Run scrape job immediately (don't await to return response quickly)
    scheduler.runScrapeJob().catch((error) => {
      console.error("Manual scrape job error:", error);
    });
    res.json({ success: true, message: "Scrape job started" });
  } catch (error) {
    console.error("Run scheduler error:", error);
    res.status(500).json({ error: "Failed to run scheduler" });
  }
});

export default router;
