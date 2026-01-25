import { db } from "./db";
import { videos, type InsertVideo, type Video } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { generateSlug } from "./utils";
import { categorizeVideo as aiCategorizeVideo } from "./ai-service";

interface ScrapedVideo {
  videoId: string;
  title: string;
  description?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  viewCount?: string | number | null;
  publishDate?: string | null;
  videoType?: string;
  embedUrl?: string | null;
}

interface VideoIngestionOptions {
  channelId: string;
  platform: "youtube" | "tiktok";
  runCategorization?: boolean;
}

interface VideoIngestionResult {
  savedCount: number;
  newVideoIds: string[];
  errors: string[];
}

/**
 * Generate a unique slug for a video by checking against existing slugs in the database
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.slug, slug))
      .limit(1);

    if (existing.length === 0) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Create a video with automatic slug generation
 */
export async function createVideoWithSlug(
  videoData: Omit<InsertVideo, "slug"> & { slug?: string }
): Promise<Video> {
  const slug = videoData.slug || (await generateUniqueSlug(videoData.title));

  const created = await storage.createVideo({
    ...videoData,
    slug,
  });

  return created;
}

/**
 * Process an array of scraped videos: dedupe, create with slugs, optionally categorize
 * This is the shared logic used by both scheduler and manual scrape endpoints
 */
export async function processScrapedVideos(
  scrapedVideos: ScrapedVideo[],
  options: VideoIngestionOptions
): Promise<VideoIngestionResult> {
  const { channelId, platform, runCategorization = false } = options;
  const result: VideoIngestionResult = {
    savedCount: 0,
    newVideoIds: [],
    errors: [],
  };

  for (const scrapedVideo of scrapedVideos) {
    try {
      const existing = await storage.getVideoByVideoId(scrapedVideo.videoId);
      if (existing) continue;

      const slug = await generateUniqueSlug(scrapedVideo.title);

      const videoType: "regular" | "youtube_short" | "tiktok" =
        platform === "tiktok"
          ? "tiktok"
          : scrapedVideo.videoType === "youtube_short"
            ? "youtube_short"
            : "regular";

      // Convert viewCount to string if it's a number
      const viewCountStr =
        scrapedVideo.viewCount != null
          ? String(scrapedVideo.viewCount)
          : null;

      const created = await storage.createVideo({
        channelId,
        videoId: scrapedVideo.videoId,
        slug,
        title: scrapedVideo.title,
        description: scrapedVideo.description || null,
        thumbnailUrl: scrapedVideo.thumbnailUrl,
        duration: scrapedVideo.duration || null,
        viewCount: viewCountStr,
        publishDate: scrapedVideo.publishDate || null,
        videoType,
        embedUrl: platform === "tiktok" ? scrapedVideo.embedUrl : null,
      });

      result.savedCount++;
      result.newVideoIds.push(created.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      result.errors.push(
        `Failed to save video ${scrapedVideo.videoId}: ${errorMessage}`
      );
      console.error(
        `[video-ingestion] Error processing video ${scrapedVideo.videoId}:`,
        error
      );
    }
  }

  if (runCategorization && result.newVideoIds.length > 0) {
    await categorizeNewVideos(result.newVideoIds);
  }

  return result;
}

/**
 * Run AI categorization on newly created videos
 * Uses the same pattern as routes.ts for consistency
 */
async function categorizeNewVideos(videoIds: string[]): Promise<void> {
  for (const videoId of videoIds) {
    try {
      const video = await storage.getVideo(videoId);
      if (!video) continue;

      const categorizationResult = await aiCategorizeVideo(
        video.title,
        video.description || ""
      );

      // Create/find categories and link them (same pattern as routes.ts)
      for (const categoryName of categorizationResult.categories) {
        const categorySlug = categoryName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");
        let category = await storage.getCategoryBySlug(categorySlug);

        if (!category) {
          category = await storage.createCategory({
            name: categoryName,
            slug: categorySlug,
          });
        }

        await storage.addVideoCategory(video.id, category.id);
      }

      // Create tags (same pattern as routes.ts)
      for (const tagName of categorizationResult.tags) {
        await storage.createTag({
          videoId: video.id,
          tagName,
        });
      }

      console.log(`[video-ingestion] Categorized: ${video.title}`);
    } catch (error) {
      console.error(
        `[video-ingestion] Failed to categorize video ${videoId}:`,
        error
      );
    }
  }
}
