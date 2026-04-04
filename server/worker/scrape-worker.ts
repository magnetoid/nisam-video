/**
 * Scrape Worker — runs heavy scraping jobs in a separate child process
 * to avoid blocking the main API server event loop.
 *
 * Communication protocol (via IPC):
 *   Parent -> Worker:  { type: "scrape", payload: { channel, incremental, jobId } }
 *   Worker -> Parent:  { type: "progress", payload: { ... } }
 *   Worker -> Parent:  { type: "log",      payload: { jobId, message, level } }
 *   Worker -> Parent:  { type: "result",   payload: { savedCount, errors } }
 *   Worker -> Parent:  { type: "error",    payload: { message, stack } }
 */

import "dotenv/config";
import { scrapeYouTubeChannel } from "../youtube-scraper.js";
import { scrapeTikTokProfile } from "../tiktok-scraper.js";
import { processScrapedVideos } from "../video-ingestion.js";
import { storage } from "../storage/index.js";
import { logger } from "../lib/logger.js";

function send(msg: Record<string, unknown>) {
  if (process.send) {
    process.send(msg);
  }
}

async function handleScrape(payload: {
  channel: {
    id: string;
    name: string;
    url: string;
    platform: string;
    videoCount: number;
  };
  incremental: boolean;
  jobId: string;
}) {
  const { channel, incremental, jobId } = payload;
  const platform = channel.platform === "tiktok" ? "tiktok" : "youtube";

  try {
    send({ type: "log", payload: { jobId, message: `Fetching videos from ${channel.url}...`, level: "info" } });

    const existingVideoIdsList = await storage.getVideoIdsByChannel(channel.id);
    const existingIds = new Set(existingVideoIdsList);

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

    send({ type: "log", payload: { jobId, message: `Found ${scrapedVideos.length} new videos.`, level: "info" } });
    send({ type: "progress", payload: { jobId, videosFound: scrapedVideos.length } });

    const result = await processScrapedVideos(scrapedVideos, {
      channelId: channel.id,
      platform,
      runCategorization: true,
    });

    send({
      type: "result",
      payload: {
        jobId,
        channelId: channel.id,
        savedCount: result.savedCount,
        errors: result.errors,
        existingVideoCount: existingVideoIdsList.length,
      },
    });
  } catch (error: any) {
    send({
      type: "error",
      payload: {
        jobId,
        channelId: channel.id,
        message: error.message || String(error),
        stack: error.stack,
      },
    });
  }
}

// Listen for messages from parent
process.on("message", async (msg: any) => {
  if (msg?.type === "scrape") {
    await handleScrape(msg.payload);
  }
  if (msg?.type === "shutdown") {
    logger.info("[Worker] Received shutdown signal");
    process.exit(0);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("[Worker] SIGTERM received, shutting down");
  process.exit(0);
});

send({ type: "ready", payload: {} });
