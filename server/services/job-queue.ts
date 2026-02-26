import { db } from "../db.js";
import { scrapeJobs, channels, type ScrapeJob } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { scrapeYouTubeChannel } from "../scraper.js";
import { scrapeTikTokProfile } from "../tiktok-scraper.js"; // Added TikTok support
import { recordError } from "../error-log-service.js";
import { storage } from "../storage/index.js";
import { invalidateChannelCaches, invalidateVideoContentCaches } from "../cache-invalidation.js";
import { appendScrapeJobLog } from "../scrape-job-logs.js";
import { processScrapedVideos } from "../video-ingestion.js"; // Import shared logic
import { logger } from "../lib/logger.js"; // Use structured logger

// Job States
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

// Job Manager
export class JobQueue {
  private static instance: JobQueue;
  private isProcessing = false;

  private constructor() {}

  static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  // Create a new job
  async createJob(type: string, targetId?: string, isIncremental = true): Promise<string> {
    const [job] = await db.insert(scrapeJobs).values({
      type,
      targetId,
      status: "pending",
      transitioning: true,
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      isIncremental,
      logs: [],
      startedAt: new Date(),
    }).returning();

    // Trigger processing asynchronously (don't await)
    this.processQueue();

    return job.id;
  }

  // Process the queue
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        // Find next pending job
        const jobs = await db.select()
          .from(scrapeJobs)
          .where(eq(scrapeJobs.status, "pending"))
          .orderBy(scrapeJobs.startedAt)
          .limit(1);

        if (jobs.length === 0) break;

        const job = jobs[0];
        await this.runJob(job);
      }
    } catch (error) {
      logger.error("Job Queue Error", error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Run a specific job
  private async runJob(job: ScrapeJob) {
    try {
      await this.updateJobStatus(job.id, "running", "Starting job...", true);

      if (job.type === "channel_scan") {
        await this.processChannelScan(job);
      } else if (job.type === "full_sync") {
        await this.processFullSync(job);
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      await this.updateJobStatus(job.id, "completed", "Job completed successfully.", false);
    } catch (error: any) {
      logger.error(`Job ${job.id} failed`, error);
      await this.updateJobStatus(job.id, "failed", `Job failed: ${error.message}`, false);
      await recordError({
        level: "error",
        type: "job_failed",
        message: error.message,
        context: { jobId: job.id, type: job.type }
      });
    }
  }

  private async processFullSync(job: ScrapeJob) {
    const allChannels = await db.select().from(channels);
    await this.updateJobProgress(job.id, 0, allChannels.length);

    let processed = 0;
    let failed = 0;

    // Process sequentially to avoid overwhelming the system
    // Could be optimized with p-map if needed, but full sync is rare
    for (const channel of allChannels) {
      try {
        await this.log(job.id, `Scanning channel: ${channel.name}`);
        await this.scrapeChannel(channel, job.isIncremental, job.id);
        processed++;
      } catch (e: any) {
        failed++;
        await this.log(job.id, `Failed to scan ${channel.name}: ${e.message}`);
        logger.error(`Failed to scan channel ${channel.id}`, e);
      }
      await this.updateJobProgress(job.id, processed, allChannels.length, processed, failed);
    }
  }

  private async processChannelScan(job: ScrapeJob) {
    if (!job.targetId) throw new Error("Target ID (channel ID) required for channel_scan");
    
    const channel = await storage.getChannel(job.targetId);
    if (!channel) throw new Error(`Channel ${job.targetId} not found`);

    await this.updateJobProgress(job.id, 0, 1); // Indeterminate items initially
    await this.scrapeChannel(channel, job.isIncremental, job.id);
    await this.updateJobProgress(job.id, 1, 1, 1, 0);
  }

  private async scrapeChannel(channel: any, incremental: boolean, jobId?: string) {
    // 1. Get existing video IDs to avoid duplicates
    const existingVideoIdsList = await storage.getVideoIdsByChannel(channel.id);
    const existingIds = new Set(existingVideoIdsList);

    // 2. Scrape
    if (jobId) await this.log(jobId, `Fetching videos from ${channel.url}...`);
    
    const platform = channel.platform === "tiktok" ? "tiktok" : "youtube";
    let scrapedVideos: any[] = [];

    if (platform === "tiktok") {
      const result = await scrapeTikTokProfile(channel.url);
      scrapedVideos = result.videos;
    } else {
      const { videos: ytVideos } = await scrapeYouTubeChannel(channel.url, {
        existingVideoIds: existingIds,
        incremental
      });
      scrapedVideos = ytVideos;
    }

    if (jobId) await this.log(jobId, `Found ${scrapedVideos.length} new videos.`);

    // 3. Save Videos & Process AI using shared logic
    const result = await processScrapedVideos(scrapedVideos, {
      channelId: channel.id,
      platform,
      runCategorization: true // Manual jobs typically want immediate categorization
    });

    if (jobId) {
      await this.log(jobId, `Saved ${result.savedCount} videos. Errors: ${result.errors.length}`);
      if (result.errors.length > 0) {
        for (const err of result.errors.slice(0, 5)) { // Log first 5 errors
          await this.log(jobId, `Error: ${err}`);
        }
      }
    }

    // Update channel stats
    await db.update(channels).set({
      lastScraped: new Date(),
      videoCount: (channel.videoCount || 0) + result.savedCount
    }).where(eq(channels.id, channel.id));

    if (result.savedCount > 0) {
      invalidateVideoContentCaches();
    }
    invalidateChannelCaches();
  }

  // Helpers
  private async updateJobStatus(id: string, status: string, message?: string, transitioning?: boolean) {
    await db.update(scrapeJobs).set({
      status,
      transitioning: transitioning !== undefined ? transitioning : false,
      errorMessage: status === "failed" ? message : null,
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
    }).where(eq(scrapeJobs.id, id));
    if (message) await this.log(id, message);
  }

  private async updateJobProgress(id: string, progress: number, total: number, processed = 0, failed = 0) {
    await db.update(scrapeJobs).set({
      transitioning: true,
      progress: Math.floor((processed / (total || 1)) * 100), // Simple percentage
      totalItems: total,
      processedItems: processed,
      failedItems: failed,
    }).where(eq(scrapeJobs.id, id));
  }

  private async log(id: string, message: string) {
    await appendScrapeJobLog(id, { level: "info", message });
  }
}

export const jobQueue = JobQueue.getInstance();
