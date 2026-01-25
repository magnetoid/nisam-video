import * as cheerio from "cheerio";

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

function detectYouTubeShort(videoRenderer: any, duration?: string): boolean {
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
  
  // Method 3: Check duration - shorts are 60 seconds or less
  if (duration) {
    const durationParts = duration.split(":").map(Number);
    let totalSeconds = 0;
    if (durationParts.length === 2) {
      totalSeconds = durationParts[0] * 60 + durationParts[1];
    } else if (durationParts.length === 1) {
      totalSeconds = durationParts[0];
    }
    // Consider videos under 60 seconds as potential shorts
    if (totalSeconds > 0 && totalSeconds <= 60) {
      return true;
    }
  }
  
  return false;
}

export async function scrapeYouTubeChannel(channelUrl: string): Promise<{
  channelInfo: ScrapedChannelInfo;
  videos: ScrapedVideo[];
}> {
  try {
    // Fetch the channel page
    const response = await fetch(channelUrl + "/videos", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch channel: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract initial data from YouTube's page
    const scriptTags = $("script").toArray();
    let initialData: any = null;

    for (const script of scriptTags) {
      const scriptContent = $(script).html() || "";
      if (scriptContent.includes("var ytInitialData =")) {
        const match = scriptContent.match(/var ytInitialData = ({.*?});/);
        if (match && match[1]) {
          try {
            initialData = JSON.parse(match[1]);
            break;
          } catch (e) {
            continue;
          }
        }
      }
    }

    const channelInfo: ScrapedChannelInfo = {};
    const videos: ScrapedVideo[] = [];

    if (initialData) {
      // Extract channel info
      const header = initialData?.header?.c4TabbedHeaderRenderer;
      if (header) {
        channelInfo.channelName = header.title;
        channelInfo.channelId = header.channelId;
        if (header.avatar?.thumbnails?.length > 0) {
          channelInfo.thumbnailUrl = header.avatar.thumbnails[0].url;
        }
      }

      // Extract videos from tabs
      const tabs = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs;
      if (tabs) {
        for (const tab of tabs) {
          const tabRenderer = tab.tabRenderer;
          if (tabRenderer?.content?.richGridRenderer) {
            const contents =
              tabRenderer.content.richGridRenderer.contents || [];

            for (const item of contents) {
              const videoRenderer =
                item.richItemRenderer?.content?.videoRenderer;
              if (videoRenderer) {
                const videoId = videoRenderer.videoId;

                // Use high-quality thumbnail URL (480x360) - reliable and available for all videos
                const thumbnailUrl = videoId
                  ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                  : videoRenderer.thumbnail?.thumbnails?.[0]?.url || "";

                const duration = videoRenderer.lengthText?.simpleText;
                const isShort = detectYouTubeShort(videoRenderer, duration);
                
                const video: ScrapedVideo = {
                  videoId,
                  title: videoRenderer.title?.runs?.[0]?.text || "",
                  description:
                    videoRenderer.descriptionSnippet?.runs?.[0]?.text || "",
                  thumbnailUrl,
                  duration,
                  viewCount: videoRenderer.viewCountText?.simpleText,
                  publishDate: videoRenderer.publishedTimeText?.simpleText,
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

    return { channelInfo, videos };
  } catch (error) {
    console.error("Scraping error:", error);
    throw new Error(
      `Failed to scrape channel: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
