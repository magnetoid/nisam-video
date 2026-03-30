import cron from "node-cron";
import { storage } from "../storage/index.js";
import { syncChannel } from "./channel-sync.js";
import { submitSitemap } from "./indexnow.js";
import { setCache } from "./redis.js";

export function startCronJobs() {
  console.log("[Cron] Starting cron jobs...");

  // Sync channels every 2 hours (at minute 0)
  cron.schedule("0 */2 * * *", async () => {
    console.log("[Cron] Starting scheduled channel sync...");
    try {
      const channels = await storage.getAllChannels();
      console.log(`[Cron] Found ${channels.length} channels to sync.`);

      // Sync one by one to avoid rate limits
      for (const channel of channels) {
        try {
            await syncChannel(channel.id);
            // Wait 10s between channels to be nice to YouTube
            await new Promise(r => setTimeout(r, 10000));
        } catch (err) {
            console.error(`[Cron] Failed to sync channel ${channel.name}:`, err);
        }
      }
      console.log("[Cron] Channel sync completed.");
    } catch (error) {
      console.error("[Cron] Global sync error:", error);
    }
  });

  // Ping search engines with sitemap daily at 3:00 AM
  cron.schedule("0 3 * * *", async () => {
    console.log("[Cron] Pinging search engines with sitemap...");
    try {
      await submitSitemap();
      console.log("[Cron] Sitemap ping completed.");
    } catch (error) {
      console.error("[Cron] Sitemap ping error:", error);
    }
  });

  // Clear sitemap cache weekly (Sunday 2:00 AM) to force regeneration
  cron.schedule("0 2 * * 0", async () => {
    console.log("[Cron] Clearing sitemap cache for regeneration...");
    try {
      // Clear sitemap Redis cache entries
      const patterns = ["sitemap:index:", "sitemap:page:"];
      for (const pattern of patterns) {
        await setCache(`${pattern}cleared`, "", 1);
      }
      console.log("[Cron] Sitemap cache cleared.");
    } catch (error) {
      console.error("[Cron] Sitemap cache clear error:", error);
    }
  });
}
