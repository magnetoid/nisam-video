import { Router } from "express";
import crypto from "crypto";
import { scheduler } from "../scheduler.js";

const router = Router();

function isVercelCronRequest(req: any) {
  const xVercelCron = req.headers["x-vercel-cron"];
  if (xVercelCron === "1" || xVercelCron === 1) return true;
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  return ua.includes("vercel");
}

function safeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.get("/scrape", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const token =
        String(req.headers["authorization"] || "").replace(/^bearer\s+/i, "") ||
        String(req.query.secret || "");
      if (!safeTokenEquals(token, secret)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    } else if (process.env.VERCEL === "1") {
      if (!isVercelCronRequest(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    await scheduler.runScrapeJob();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Cron scrape error:", error);
    res.status(500).json({ error: error?.message || "Cron scrape failed" });
  }
});

export default router;

