/**
 * Worker Manager — spawns and manages child processes for heavy scraping work.
 *
 * Falls back to in-process execution when:
 *  - Running on Vercel (no child_process support)
 *  - WORKER_MODE=inline is set
 *  - Worker process fails to spawn
 */

import { fork, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type WorkerMessage =
  | { type: "ready"; payload: Record<string, never> }
  | { type: "log"; payload: { jobId: string; message: string; level: string } }
  | { type: "progress"; payload: { jobId: string; videosFound?: number } }
  | { type: "result"; payload: { jobId: string; channelId: string; savedCount: number; errors: string[]; existingVideoCount: number } }
  | { type: "error"; payload: { jobId: string; channelId: string; message: string; stack?: string } };

type MessageHandler = (msg: WorkerMessage) => void;

class WorkerManager {
  private worker: ChildProcess | null = null;
  private messageHandlers = new Map<string, MessageHandler>();
  private isServerless: boolean;
  private useInline: boolean;

  constructor() {
    this.isServerless = process.env.VERCEL === "1";
    this.useInline = this.isServerless || process.env.WORKER_MODE === "inline";
  }

  /**
   * Send a scrape task to the worker. Returns a promise that resolves
   * when the worker sends back a "result" or "error" for this job.
   */
  async scrapeChannel(
    channel: { id: string; name: string; url: string; platform: string; videoCount: number },
    incremental: boolean,
    jobId: string,
    onMessage?: MessageHandler,
  ): Promise<{ savedCount: number; errors: string[]; existingVideoCount: number }> {
    if (this.useInline) {
      return this.scrapeInline(channel, incremental, jobId, onMessage);
    }

    return new Promise((resolve, reject) => {
      const worker = this.getOrSpawnWorker();

      const handler = (msg: WorkerMessage) => {
        // Forward all messages to caller
        if (onMessage) onMessage(msg);

        if (msg.type === "result" && msg.payload.jobId === jobId) {
          this.messageHandlers.delete(jobId);
          resolve({
            savedCount: msg.payload.savedCount,
            errors: msg.payload.errors,
            existingVideoCount: msg.payload.existingVideoCount,
          });
        }

        if (msg.type === "error" && msg.payload.jobId === jobId) {
          this.messageHandlers.delete(jobId);
          reject(new Error(msg.payload.message));
        }
      };

      this.messageHandlers.set(jobId, handler);

      worker.send({
        type: "scrape",
        payload: { channel, incremental, jobId },
      });
    });
  }

  private getOrSpawnWorker(): ChildProcess {
    if (this.worker && !this.worker.killed) {
      return this.worker;
    }

    const workerPath = path.resolve(__dirname, "scrape-worker.js");
    logger.info(`[WorkerManager] Spawning worker: ${workerPath}`);

    this.worker = fork(workerPath, [], {
      stdio: ["pipe", "inherit", "inherit", "ipc"],
      env: { ...process.env },
    });

    this.worker.on("message", (msg: WorkerMessage) => {
      for (const handler of this.messageHandlers.values()) {
        handler(msg);
      }
    });

    this.worker.on("exit", (code) => {
      logger.warn(`[WorkerManager] Worker exited with code ${code}`);
      this.worker = null;

      // Reject all pending handlers
      for (const [jobId, handler] of this.messageHandlers.entries()) {
        handler({
          type: "error",
          payload: { jobId, channelId: "", message: `Worker process exited with code ${code}` },
        });
      }
      this.messageHandlers.clear();
    });

    this.worker.on("error", (err) => {
      logger.error("[WorkerManager] Worker error:", err);
    });

    return this.worker;
  }

  /**
   * Inline fallback — runs scraping in the current process.
   * Used on Vercel or when WORKER_MODE=inline.
   */
  private async scrapeInline(
    channel: { id: string; name: string; url: string; platform: string; videoCount: number },
    incremental: boolean,
    jobId: string,
    onMessage?: MessageHandler,
  ): Promise<{ savedCount: number; errors: string[]; existingVideoCount: number }> {
    // Dynamic import to keep the worker module optional at load time
    const { scrapeYouTubeChannel } = await import("../youtube-scraper.js");
    const { scrapeTikTokProfile } = await import("../tiktok-scraper.js");
    const { processScrapedVideos } = await import("../video-ingestion.js");
    const { storage } = await import("../storage/index.js");

    const platform = channel.platform === "tiktok" ? "tiktok" : "youtube";

    const existingVideoIdsList = await storage.getVideoIdsByChannel(channel.id);
    const existingIds = new Set(existingVideoIdsList);

    onMessage?.({ type: "log", payload: { jobId, message: `Fetching videos from ${channel.url}...`, level: "info" } });

    let scrapedVideos: any[];

    if (platform === "tiktok") {
      const result = await scrapeTikTokProfile(channel.url);
      scrapedVideos = result.videos;
    } else {
      const { videos: ytVideos } = await scrapeYouTubeChannel(channel.url, {
        existingVideoIds: existingIds,
        incremental,
        maxItems: 60,
      });
      scrapedVideos = ytVideos;
    }

    onMessage?.({ type: "log", payload: { jobId, message: `Found ${scrapedVideos.length} new videos.`, level: "info" } });

    const result = await processScrapedVideos(scrapedVideos, {
      channelId: channel.id,
      platform,
      runCategorization: true,
    });

    return {
      savedCount: result.savedCount,
      errors: result.errors,
      existingVideoCount: existingVideoIdsList.length,
    };
  }

  shutdown() {
    if (this.worker && !this.worker.killed) {
      this.worker.send({ type: "shutdown" });
      // Force kill after 5s
      setTimeout(() => {
        if (this.worker && !this.worker.killed) {
          this.worker.kill("SIGKILL");
        }
      }, 5000);
    }
  }
}

export const workerManager = new WorkerManager();
