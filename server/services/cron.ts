import cron from "node-cron";
import { storage } from "../storage/index.js";
import { syncChannel } from "./channel-sync.js";

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
}
