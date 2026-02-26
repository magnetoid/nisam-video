import { Router } from "express";
import { scheduler } from "../scheduler.js";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage/index.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const jobs = await storage.getRecentScrapeJobs(20);
    res.json(jobs);
  } catch (error) {
    logger.error("Get scrape jobs error:", error);
    res.status(500).json({ error: "Failed to fetch scrape jobs" });
  }
});

router.get("/", async (req, res) => {
  try {
    const settings = await scheduler.getSettings();
    const status = scheduler.getStatus();
    res.json({ ...settings, ...status });
  } catch (error) {
    logger.error("Get scheduler error:", error);
    res.status(500).json({ error: "Failed to fetch scheduler status" });
  }
});

router.post("/start", requireAuth, async (req, res) => {
  try {
    await scheduler.start();
    const settings = await scheduler.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    logger.error("Start scheduler error:", error);
    res.status(500).json({ error: "Failed to start scheduler" });
  }
});

router.post("/stop", requireAuth, async (req, res) => {
  try {
    await scheduler.stop();
    const settings = await scheduler.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    logger.error("Stop scheduler error:", error);
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
    logger.error("Update scheduler error:", error);
    res.status(500).json({ error: "Failed to update scheduler" });
  }
});

router.post("/run-now", requireAuth, async (req, res) => {
  try {
    await scheduler.runScrapeJob({ source: "manual", maxBatchSize: 1, retries: 1 });
    res.json({ success: true, message: "Scrape job completed" });
  } catch (error) {
    logger.error("Run scheduler error:", error);
    res.status(500).json({ error: "Failed to run scheduler" });
  }
});

export default router;
