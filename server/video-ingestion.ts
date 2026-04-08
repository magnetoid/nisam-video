import { videos, type InsertVideo, type Video } from "../shared/schema.js";
import { storage } from "./storage.js";
import { generateSlug } from "./utils.js";
import { categorizeVideo as aiCategorizeVideo } from "./ai-service.js";
import { logger } from "./lib/logger.js";
import { notifyVideoChange, submitUrls } from "./services/indexnow.js";
import { scrapeYouTubeVideoPage } from "./video-scraper.js";

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
    const existing = await storage.getVideoBySlug(slug);

    if (!existing) break;
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
      logger.error(
        `[video-ingestion] Error processing video ${scrapedVideo.videoId}:`,
        error
      );
    }
  }

  if (runCategorization && result.newVideoIds.length > 0) {
    await categorizeNewVideos(result.newVideoIds);
  }

  // Enrich descriptions by scraping individual video pages (runs in background)
  if (result.newVideoIds.length > 0 && platform === "youtube") {
    enrichVideoDescriptions(result.newVideoIds).then(({ enriched, failed }) => {
      if (enriched > 0) {
        logger.info(`[video-ingestion] Description enrichment complete: ${enriched} enriched, ${failed} failed`);
      }
    }).catch(err => {
      logger.error("[video-ingestion] Description enrichment error:", err);
    });
  }

  // Notify IndexNow about newly created videos
  if (result.newVideoIds.length > 0) {
    try {
      const baseUrl = process.env.PUBLIC_BASE_URL || "https://nisam.video";
      const urls: string[] = [];
      for (const id of result.newVideoIds) {
        const video = await storage.getVideo(id);
        if (video) {
          urls.push(`${baseUrl}/video/${video.slug || video.id}`);
        }
      }
      if (urls.length > 0) {
        submitUrls(urls);
      }
    } catch (err) {
      logger.error("[video-ingestion] IndexNow notification failed:", err);
    }
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

      // Process Categories
      // We attempt to match English and Serbian categories by index
      const maxCategories = Math.max(
        categorizationResult.categories.en.length,
        categorizationResult.categories.sr.length
      );

      for (let i = 0; i < maxCategories; i++) {
        const nameEn = categorizationResult.categories.en[i];
        const nameSr = categorizationResult.categories.sr[i];

        // Skip if no English name (we use it as primary identifier for slug)
        if (!nameEn) continue;

        const categorySlug = nameEn
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");
        
        let category = await storage.getLocalizedCategoryBySlug(categorySlug, 'en');

        if (!category) {
          const translations: { languageCode: string; name: string; slug: string; description: string | null }[] = [];
          translations.push({
            languageCode: 'en',
            name: nameEn,
            slug: categorySlug,
            description: null
          });

          if (nameSr) {
            translations.push({
              languageCode: 'sr-Latn',
              name: nameSr,
              slug: categorySlug, // Share slug or generate new? Using same slug for simplicity
              description: null
            });
          }

          category = await storage.createCategory({}, translations);
        } else if (nameSr) {
          // If category exists but might miss Serbian translation, try to add it
          try {
             // Check if translation exists (this logic would be in storage but we can try adding)
             // For now, we assume if it exists we use it. 
             // Ideally we'd update it, but let's keep it simple.
             await storage.addCategoryTranslation(category.id, {
                categoryId: category.id,
                languageCode: 'sr-Latn',
                name: nameSr,
                slug: categorySlug,
                description: null
             }).catch(() => {}); // Ignore if exists
          } catch (e) {
            // Ignore unique constraint errors
          }
        }

        await storage.addVideoCategory(video.id, category.id);
      }

      // Process Tags
      // We match English and Serbian tags by index
      const maxTags = Math.max(
        categorizationResult.tags.en.length,
        categorizationResult.tags.sr.length
      );

      for (let i = 0; i < maxTags; i++) {
        const tagEn = categorizationResult.tags.en[i];
        const tagSr = categorizationResult.tags.sr[i];

        if (!tagEn) continue;

        const translations = [{
          languageCode: 'en',
          tagName: tagEn
        }];

        if (tagSr) {
          translations.push({
            languageCode: 'sr-Latn',
            tagName: tagSr
          });
        }

        await storage.createTag({ videoId: video.id }, translations);
      }

      logger.info(`[video-ingestion] Categorized: ${video.title}`);
    } catch (error) {
      logger.error(
        `[video-ingestion] Failed to categorize video ${videoId}:`,
        error
      );
    }
  }
}

/**
 * Enrich videos with full descriptions by scraping individual YouTube pages.
 * YouTube channel listings only provide truncated description snippets (~100-200 chars).
 * This fetches the full description from each video's watch page.
 *
 * @param videoIds - Array of internal video IDs to enrich
 * @param delayMs - Delay between requests to avoid rate limiting (default 1500ms)
 */
export async function enrichVideoDescriptions(
  videoIds: string[],
  delayMs: number = 1500
): Promise<{ enriched: number; failed: number }> {
  let enriched = 0;
  let failed = 0;

  for (const id of videoIds) {
    try {
      const video = await storage.getVideo(id);
      if (!video) continue;

      // Skip TikTok videos (scraper is YouTube-only)
      if (video.videoType === "tiktok") continue;

      // Skip if description already looks full (> 300 chars suggests it was already enriched)
      if (video.description && video.description.length > 300) continue;

      const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
      const result = await scrapeYouTubeVideoPage(videoUrl);

      if (result.success && result.data?.description) {
        const fullDescription = result.data.description;

        // Only update if the scraped description is longer than what we have
        if (!video.description || fullDescription.length > video.description.length) {
          await storage.updateVideo(video.id, {
            description: fullDescription,
            // Also update duration and viewCount if available and missing
            ...(result.data.duration && !video.duration && { duration: result.data.duration }),
            ...(result.data.viewCount && { viewCount: result.data.viewCount }),
          });
          enriched++;
          logger.info(`[video-ingestion] Enriched description for: ${video.title} (${fullDescription.length} chars)`);
        }
      } else {
        failed++;
        logger.warn(`[video-ingestion] Could not enrich: ${video.title}`);
      }

      // Rate limiting delay
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      failed++;
      logger.error(`[video-ingestion] Enrich failed for ${id}:`, error);
    }
  }

  return { enriched, failed };
}
