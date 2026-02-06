import * as cheerio from "cheerio";
import { recordError } from "./error-log-service.js";

export interface ScrapedVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration?: string;
  viewCount?: string;
  publishDate?: string;
  videoType: "regular" | "youtube_short" | "tiktok";
}

export interface ScrapedChannelInfo {
  channelId?: string;
  channelName?: string;
  thumbnailUrl?: string;
}

function detectYouTubeShort(videoRenderer: any): boolean {
  // Method 1: Check navigation endpoint for /shorts/ URL
  const navigationEndpoint = videoRenderer.navigationEndpoint;
  if (navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.includes("/shorts/")) {
    return true;
  }
  
  // Method 2: Check for overlayStyle that indicates a Short
  const overlayStyle = videoRenderer.thumbnailOverlays?.find(
    (overlay: any) => overlay.thumbnailOverlayTimeStatusRenderer?.style === "SHORTS"
  );
  if (overlayStyle) {
    return true;
  }

  return false;
}

export async function scrapeYouTubeChannel(
  channelUrl: string,
  options: {
    existingVideoIds?: Set<string>;
    incremental?: boolean;
    knownStreakLimit?: number;
  } = {}
): Promise<{
  channelInfo: ScrapedChannelInfo;
  videos: ScrapedVideo[];
}> {
  try {
    const normalized = channelUrl.replace(/\/+$/, "");
    const targetUrl = normalized.includes("/shorts") ? normalized : `${normalized}/videos`;

    // Fetch the channel page
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch channel: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract initial data from YouTube's page
    const scriptTags = $("script").toArray();
    let initialData: any = null;

    // Strategy 1: Look for ytInitialData variable declaration
    for (const script of scriptTags) {
      const scriptContent = $(script).html() || "";
      
      // Match "var ytInitialData =" or "window["ytInitialData"] ="
      const match = scriptContent.match(/(?:var\s+ytInitialData|window\["ytInitialData"\]|window\.ytInitialData)\s*=\s*({.*?});/);
      if (match && match[1]) {
        try {
          initialData = JSON.parse(match[1]);
          break;
        } catch (e) {
          // Continue to next script if parsing fails
          continue;
        }
      }
    }

    const channelInfo: ScrapedChannelInfo = {};
    const videos: ScrapedVideo[] = [];

    // Fallback: Extract from Meta Tags if JSON parsing failed completely
    if (!initialData) {
        const ogTitle = $('meta[property="og:title"]').attr('content');
        const ogImage = $('meta[property="og:image"]').attr('content');
        
        if (ogTitle) channelInfo.channelName = ogTitle;
        if (ogImage) channelInfo.thumbnailUrl = ogImage;
        
        // Record warning but don't fail yet if we can't find videos
        await recordError({
            level: "warn",
            type: "scraper_partial_data",
            message: "Could not parse ytInitialData, falling back to meta tags for channel info",
            module: "scraper",
            url: channelUrl
        });
    }

    if (initialData) {
      // Extract channel info
      const header = initialData?.header?.c4TabbedHeaderRenderer || initialData?.header?.pageHeaderRenderer;
      if (header) {
        channelInfo.channelName = header.title || header.pageTitle;
        channelInfo.channelId = header.channelId;
        const thumbnails = header.avatar?.thumbnails || header.content?.image?.thumbnails;
        if (thumbnails?.length > 0) {
          channelInfo.thumbnailUrl = thumbnails[0].url;
        }
      }

      // Extract videos from tabs
      const tabs = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs;
      if (tabs) {
        const knownStreakLimit = Math.max(1, options.knownStreakLimit ?? 12);
        let knownStreak = 0;
        let stop = false;

        for (const tab of tabs) {
          if (stop) break;
          const tabRenderer = tab.tabRenderer;
          // Check for richGridRenderer (Videos tab) or richListRenderer
          const content = tabRenderer?.content?.richGridRenderer || tabRenderer?.content?.sectionListRenderer;
          
          if (content) {
            // Normalize contents array from different renderer types
            let items: any[] = [];
            
            if (content.contents) {
                items = content.contents;
            } else if (content.subMenu) {
                // Sometimes structured differently
            }

            for (const item of items) {
              if (stop) break;
              // Handle richItemRenderer (standard)
              const videoRenderer = item.richItemRenderer?.content?.videoRenderer;
              // Handle itemSectionRenderer (sometimes used in lists)
              const itemSection = item.itemSectionRenderer?.contents?.[0]?.videoRenderer;
              
              const renderer = videoRenderer || itemSection;

              if (renderer) {
                const videoId = renderer.videoId;

                // Optimization: Skip if video already exists
                if (options.existingVideoIds && options.existingVideoIds.has(videoId)) {
                  if (options.incremental) {
                    knownStreak += 1;
                    if (knownStreak >= knownStreakLimit) {
                      stop = true;
                      break;
                    }
                    continue;
                  }
                }
                knownStreak = 0;

                // Use high-quality thumbnail URL (480x360) - reliable and available for all videos
                const thumbnailUrl = videoId
                  ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                  : renderer.thumbnail?.thumbnails?.[0]?.url || "";

                const duration = renderer.lengthText?.simpleText;
                const isShort = detectYouTubeShort(renderer);
                
                const video: ScrapedVideo = {
                  videoId,
                  title: renderer.title?.runs?.[0]?.text || "",
                  description:
                    renderer.descriptionSnippet?.runs?.[0]?.text || "",
                  thumbnailUrl,
                  duration,
                  viewCount: renderer.viewCountText?.simpleText,
                  publishDate: renderer.publishedTimeText?.simpleText,
                  videoType: isShort ? "youtube_short" : "regular",
                };

                if (video.videoId && video.title) {
                  videos.push(video);
                }
              }
            }
          }
        }
      }
    }

    if (!channelInfo.channelName && !videos.length) {
        throw new Error("No channel info or videos found in scraped data");
    }

    return { channelInfo, videos };
  } catch (error: any) {
    console.error("Scraping error:", error);
    await recordError({
        level: "error",
        type: "scraper_failed",
        message: error.message,
        stack: error.stack,
        module: "scraper",
        url: channelUrl
    });
    throw new Error(
      `Failed to scrape channel: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
