import * as cron from "node-cron";
import pRetry from "p-retry";
import { CronExpressionParser } from "cron-parser";
import { scrapeYouTubeChannel } from "./scraper.js";
import { scrapeTikTokProfile } from "./tiktok-scraper.js";
import { storage } from "./storage.js";
import { processScrapedVideos } from "./video-ingestion.js";
import { appendScrapeJobLog } from "./scrape-job-logs.js";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

class SchedulerService {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  async init() {
    // Ensure scheduler settings exist
    const settings = await this.getSettings();
    if (!settings) {
      await storage.updateSchedulerSettings({
        isEnabled: 0,
        intervalHours: 6,
      });
    } else if (settings.isEnabled) {
      // Start scheduler if enabled
      await this.start();
    }
  }

  async getSettings() {
    return storage.getSchedulerSettings();
  }

  async updateSettings(data: { isEnabled?: number; intervalHours?: number }) {
    return storage.updateSchedulerSettings(data);
  }

  async start() {
    if (this.task) {
      this.task.stop();
    }

    const settings = await this.getSettings();
    if (!settings) return;

    // Calculate cron expression based on interval
    const cronExpression = this.getCronExpression(settings.intervalHours);
    const timezone = settings.timezone || 'UTC';

    this.task = cron.schedule(cronExpression, async () => {
      await this.runScrapeJob();
    }, { timezone });

    await this.updateSettings({ isEnabled: 1 });
    await this.updateNextRunTime();

    console.log(
      `[Scheduler] Started with interval: ${settings.intervalHours} hours (TZ: ${timezone})`,
    );
  }

  async stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    // Clear next run time when stopping
    await storage.updateSchedulerSettings({ isEnabled: 0, nextRun: null });

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

      const settings = await this.getSettings();
      const intervalHours = settings?.intervalHours || 6;
      const cutoffMs = Date.now() - intervalHours * 60 * 60 * 1000;
      const maxBatchSize = process.env.VERCEL === "1" ? 2 : 50;
      const batchSize = Math.max(
        1,
        Math.min(maxBatchSize, parseInt(process.env.SCRAPE_BATCH_SIZE || "10", 10) || 10),
      );

      // Get all channels, then process incrementally based on lastScraped
      const allChannels = await storage.getAllChannels();
      const channelsNeedingScrape = allChannels
        .filter((channel) => {
          const last = channel.lastScraped ? new Date(channel.lastScraped).getTime() : 0;
          return !last || last < cutoffMs;
        })
        .sort((a, b) => {
          const aLast = a.lastScraped ? new Date(a.lastScraped).getTime() : 0;
          const bLast = b.lastScraped ? new Date(b.lastScraped).getTime() : 0;
          return aLast - bLast;
        });

      const batch = channelsNeedingScrape.slice(0, batchSize);
      console.log(
        `[Scheduler] Incremental batch: ${batch.length}/${channelsNeedingScrape.length} channels due (total channels: ${allChannels.length}, cutoff: ${intervalHours}h)`,
      );

      const job = await storage.createScrapeJob({
        type: "scheduler_incremental",
        isIncremental: true,
        status: "running",
        transitioning: true,
        progress: 0,
        totalItems: batch.length,
        processedItems: 0,
        failedItems: 0,
        totalChannels: batch.length,
        processedChannels: 0,
        currentChannelName: batch[0]?.name || null,
        videosAdded: 0,
        errorMessage: null,
        completedAt: null,
      });
      try {
        await appendScrapeJobLog(job.id, {
          level: "info",
          message: "Scheduler incremental job started",
          data: { totalChannels: batch.length, intervalHours },
        });
      } catch {}

      let scrapedCount = 0;
      let errorCount = 0;
      let attemptedCount = 0;
      let videosAddedTotal = 0;
      const baseDelayMs = Math.max(
        0,
        Math.min(10000, parseInt(process.env.SCRAPE_DELAY_MS || "300", 10) || 0),
      );
      const maxDelayMs = Math.max(
        baseDelayMs,
        Math.min(20000, parseInt(process.env.SCRAPE_DELAY_MAX_MS || "3000", 10) || 3000),
      );

      for (const channel of batch) {
        await storage.updateScrapeJob(job.id, {
        status: "running",
        transitioning: true,
        currentChannelName: channel.name,
        processedChannels: attemptedCount,
        processedItems: attemptedCount,
        totalItems: batch.length,
        failedItems: errorCount,
        progress:
          batch.length > 0 ? Math.min(100, Math.round((attemptedCount / batch.length) * 100)) : 0,
        videosAdded: videosAddedTotal,
        errorMessage: errorCount > 0 ? `errors:${errorCount}` : null,
      });
        try {
          await appendScrapeJobLog(job.id, {
            level: "info",
            message: "Channel scrape started",
            channelId: channel.id,
            channelName: channel.name,
            data: { platform: channel.platform || "youtube" },
          });
        } catch {}

        try {
          const platform = channel.platform === "tiktok" ? "tiktok" : "youtube";
          const existingVideoIdsList = await storage.getVideoIdsByChannel(channel.id);
          const existingVideoIds =
            platform === "youtube"
              ? new Set(existingVideoIdsList)
              : undefined;
          const existingVideoCount = existingVideoIdsList.length;

          await pRetry(
            async () => {
              console.log(`[Scheduler] Scraping ${channel.platform || 'youtube'} channel: ${channel.name}`);
              
              let savedCount = 0;
              let videosFound = 0;

              // Use shared video ingestion utility for both platforms
              let scrapedVideos: any[];

              if (platform === "tiktok") {
                const result = await scrapeTikTokProfile(channel.url);
                scrapedVideos = result.videos;
              } else {
                const { videos: ytVideos } = await scrapeYouTubeChannel(channel.url, {
                  existingVideoIds,
                  incremental: true,
                  knownStreakLimit: Math.max(
                    1,
                    Math.min(
                      50,
                      parseInt(process.env.SCRAPE_KNOWN_STREAK_LIMIT || "12", 10) || 12,
                    ),
                  ),
                });
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
              videosAddedTotal += savedCount;

              await storage.updateChannel(channel.id, {
                videoCount: existingVideoCount + savedCount,
                lastScraped: new Date(),
              });

              scrapedCount++;
              console.log(
                `[Scheduler] Channel ${channel.name}: found ${videosFound}, saved ${savedCount} new videos`,
              );
              try {
                await appendScrapeJobLog(job.id, {
                  level: "info",
                  message: "Channel scrape completed",
                  channelId: channel.id,
                  channelName: channel.name,
                  data: { platform, videosFound, videosSaved: savedCount },
                });
              } catch {}
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
          try {
            await appendScrapeJobLog(job.id, {
              level: "error",
              message: "Channel scrape failed",
              channelId: channel.id,
              channelName: channel.name,
              data: { error: (error as any)?.message || String(error) },
            });
          } catch {}
        } finally {
          attemptedCount += 1;
          await storage.updateScrapeJob(job.id, {
            status: "running",
            currentChannelName: channel.name,
            processedChannels: attemptedCount,
            processedItems: attemptedCount,
            totalItems: batch.length,
            failedItems: errorCount,
            progress:
              batch.length > 0 ? Math.min(100, Math.round((attemptedCount / batch.length) * 100)) : 0,
            videosAdded: videosAddedTotal,
            errorMessage: errorCount > 0 ? `errors:${errorCount}` : null,
          });
          if (baseDelayMs > 0) {
            const errorRatio = errorCount / Math.max(1, attemptedCount);
            const adaptive = Math.min(maxDelayMs, Math.round(baseDelayMs * (1 + errorRatio * 2)));
            const jitter = Math.round(adaptive * (0.85 + Math.random() * 0.3));
            await sleep(jitter);
          }
        }
      }

      console.log(
        `[Scheduler] Scrape job completed. Scraped ${scrapedCount}/${batch.length} channels in batch. Errors: ${errorCount}. Remaining due: ${Math.max(0, channelsNeedingScrape.length - batch.length)}`,
      );

      await storage.updateScrapeJob(job.id, {
        status: errorCount === batch.length && batch.length > 0 ? "failed" : "completed",
        transitioning: false,
        processedChannels: attemptedCount,
        processedItems: attemptedCount,
        totalItems: batch.length,
        failedItems: errorCount,
        progress: 100,
        currentChannelName: null,
        videosAdded: videosAddedTotal,
        errorMessage: errorCount > 0 ? `errors:${errorCount}` : null,
        completedAt: new Date(),
      });
      try {
        await appendScrapeJobLog(job.id, {
          level: "info",
          message: "Scheduler incremental job finished",
          data: {
            totalChannels: batch.length,
            channelsAttempted: attemptedCount,
            channelsSucceeded: scrapedCount,
            channelsFailed: errorCount,
            videosAdded: videosAddedTotal,
          },
        });
      } catch {}

      // Update next run time only if scheduler is still enabled
      const settingsAfter = await this.getSettings();
      if (settingsAfter && settingsAfter.isEnabled) {
        await this.updateNextRunTime();
      }
    } catch (error) {
      console.error("[Scheduler] Scrape job failed:", error);
      try {
        const activeJob = await storage.getActiveScrapeJob();
        if (activeJob) {
          await storage.updateScrapeJob(activeJob.id, {
            status: "failed",
            transitioning: false,
            errorMessage: (error as any)?.message || "failed",
            completedAt: new Date(),
          });
        }
      } catch {}
    } finally {
      this.isRunning = false;
    }
  }

  private async updateLastRunTime() {
    await storage.updateSchedulerSettings({ lastRun: new Date() });
  }

  private async updateNextRunTime() {
    const settings = await this.getSettings();
    if (settings) {
      try {
        // Calculate actual next cron fire time
        const cronExpression = this.getCronExpression(settings.intervalHours);
        const interval = CronExpressionParser.parse(cronExpression);
        const nextRun = interval.next().toDate();

        await storage.updateSchedulerSettings({ nextRun });
      } catch (error) {
        console.error("[Scheduler] Error calculating next run time:", error);
        // Fallback to simple calculation
        const nextRun = new Date();
        nextRun.setHours(nextRun.getHours() + settings.intervalHours);
        await storage.updateSchedulerSettings({ nextRun });
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
