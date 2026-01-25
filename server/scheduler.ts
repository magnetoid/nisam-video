import * as cron from "node-cron";
import pRetry from "p-retry";
import { CronExpressionParser } from "cron-parser";
import { db } from "./db";
import { schedulerSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrapeYouTubeChannel } from "./scraper";
import { scrapeTikTokProfile } from "./tiktok-scraper";
import { storage } from "./storage";
import { processScrapedVideos } from "./video-ingestion";

class SchedulerService {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  async init() {
    // Ensure scheduler settings exist
    const settings = await this.getSettings();
    if (!settings) {
      await db.insert(schedulerSettings).values({
        isEnabled: 0,
        intervalHours: 6,
      });
    } else if (settings.isEnabled) {
      // Start scheduler if enabled
      await this.start();
    }
  }

  async getSettings() {
    const [settings] = await db.select().from(schedulerSettings).limit(1);
    return settings || null;
  }

  async updateSettings(data: { isEnabled?: number; intervalHours?: number }) {
    const [settings] = await db.select().from(schedulerSettings).limit(1);

    if (!settings) {
      const [newSettings] = await db
        .insert(schedulerSettings)
        .values({
          isEnabled: data.isEnabled ?? 0,
          intervalHours: data.intervalHours ?? 6,
        })
        .returning();
      return newSettings;
    }

    const [updated] = await db
      .update(schedulerSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schedulerSettings.id, settings.id))
      .returning();

    return updated;
  }

  async start() {
    if (this.task) {
      this.task.stop();
    }

    const settings = await this.getSettings();
    if (!settings) return;

    // Calculate cron expression based on interval
    const cronExpression = this.getCronExpression(settings.intervalHours);

    this.task = cron.schedule(cronExpression, async () => {
      await this.runScrapeJob();
    });

    await this.updateSettings({ isEnabled: 1 });
    await this.updateNextRunTime();

    console.log(
      `[Scheduler] Started with interval: ${settings.intervalHours} hours`,
    );
  }

  async stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    // Clear next run time when stopping
    const [settings] = await db.select().from(schedulerSettings).limit(1);
    if (settings) {
      await db
        .update(schedulerSettings)
        .set({ isEnabled: 0, nextRun: null })
        .where(eq(schedulerSettings.id, settings.id));
    }

    console.log("[Scheduler] Stopped");
  }

  async runScrapeJob() {
    if (this.isRunning) {
      console.log("[Scheduler] Scrape job already running, skipping...");
      return;
    }

    this.isRunning = true;
    console.log("[Scheduler] Starting scrape job...");

    try {
      // Update last run time
      await this.updateLastRunTime();

      // Get all channels
      const allChannels = await storage.getAllChannels();

      let scrapedCount = 0;
      let errorCount = 0;

      for (const channel of allChannels) {
        try {
          await pRetry(
            async () => {
              console.log(`[Scheduler] Scraping ${channel.platform || 'youtube'} channel: ${channel.name}`);
              
              let savedCount = 0;
              let videosFound = 0;

              // Use shared video ingestion utility for both platforms
              let scrapedVideos: any[];
              const platform = channel.platform === "tiktok" ? "tiktok" : "youtube";

              if (platform === "tiktok") {
                const result = await scrapeTikTokProfile(channel.url);
                scrapedVideos = result.videos;
              } else {
                const { videos: ytVideos } = await scrapeYouTubeChannel(channel.url);
                scrapedVideos = ytVideos;
              }

              videosFound = scrapedVideos.length;

              // Process all scraped videos through shared utility
              const ingestionResult = await processScrapedVideos(scrapedVideos, {
                channelId: channel.id,
                platform,
                runCategorization: false, // Scheduler runs categorization separately
              });

              savedCount = ingestionResult.savedCount;

              const allChannelVideos = await storage.getAllVideos({
                channelId: channel.id,
              });
              await storage.updateChannel(channel.id, {
                videoCount: allChannelVideos.length,
                lastScraped: new Date(),
              });

              scrapedCount++;
              console.log(
                `[Scheduler] Channel ${channel.name}: found ${videosFound}, saved ${savedCount} new videos`,
              );
            },
            {
              retries: 3,
              minTimeout: 1000,
              maxTimeout: 5000,
              onFailedAttempt: (error) => {
                console.log(
                  `[Scheduler] Retry attempt ${error.attemptNumber} for channel ${channel.name}`,
                );
              },
            },
          );
        } catch (error) {
          errorCount++;
          console.error(
            `[Scheduler] Failed to scrape channel ${channel.name} after retries:`,
            error,
          );
        }
      }

      console.log(
        `[Scheduler] Scrape job completed. Scraped ${scrapedCount}/${allChannels.length} channels. Errors: ${errorCount}`,
      );

      // Update next run time only if scheduler is still enabled
      const settings = await this.getSettings();
      if (settings && settings.isEnabled) {
        await this.updateNextRunTime();
      }
    } catch (error) {
      console.error("[Scheduler] Scrape job failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  private async updateLastRunTime() {
    const [settings] = await db.select().from(schedulerSettings).limit(1);
    if (settings) {
      await db
        .update(schedulerSettings)
        .set({ lastRun: new Date() })
        .where(eq(schedulerSettings.id, settings.id));
    }
  }

  private async updateNextRunTime() {
    const [settings] = await db.select().from(schedulerSettings).limit(1);
    if (settings) {
      try {
        // Calculate actual next cron fire time
        const cronExpression = this.getCronExpression(settings.intervalHours);
        const interval = CronExpressionParser.parse(cronExpression);
        const nextRun = interval.next().toDate();

        await db
          .update(schedulerSettings)
          .set({ nextRun })
          .where(eq(schedulerSettings.id, settings.id));
      } catch (error) {
        console.error("[Scheduler] Error calculating next run time:", error);
        // Fallback to simple calculation
        const nextRun = new Date();
        nextRun.setHours(nextRun.getHours() + settings.intervalHours);
        await db
          .update(schedulerSettings)
          .set({ nextRun })
          .where(eq(schedulerSettings.id, settings.id));
      }
    }
  }

  private getCronExpression(intervalHours: number): string {
    // Convert hours to cron expression
    // For simplicity, we'll use */N hours pattern
    if (intervalHours === 1) return "0 * * * *"; // Every hour
    if (intervalHours === 6) return "0 */6 * * *"; // Every 6 hours
    if (intervalHours === 12) return "0 */12 * * *"; // Every 12 hours
    if (intervalHours === 24) return "0 0 * * *"; // Every day

    // Default to every 6 hours for other intervals
    return "0 */6 * * *";
  }

  getStatus() {
    return {
      isActive: this.task !== null, // Scheduler is enabled/active
      isRunning: this.isRunning, // Job is currently executing
    };
  }
}

export const scheduler = new SchedulerService();
