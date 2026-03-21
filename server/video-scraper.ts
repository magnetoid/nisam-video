import * as cheerio from "cheerio";
import { recordError } from "./error-log-service.js";

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[video-scraper] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[video-scraper] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[video-scraper] ${msg}`, ...args),
};

export interface ScrapedVideoDetails {
  videoId: string;
  title: string;
  description: string;
  viewCount: string;
  likeCount?: string;
  publishDate?: string;
  channelId?: string;
  channelName?: string;
  channelUrl?: string;
  duration?: string;
  keywords?: string[];
  category?: string;
  thumbnailUrl?: string;
  isLive?: boolean;
  isShort?: boolean;
}

export interface ScrapeVideoResult {
  success: boolean;
  data?: ScrapedVideoDetails;
  error?: string;
  partial?: boolean;
}

function extractInitialData(html: string): any | null {
  const $ = cheerio.load(html);
  const scriptTags = $("script").toArray();
  
  for (const script of scriptTags) {
    const scriptContent = $(script).html() || "";
    
    const patterns = [
      /(?:var\s+ytInitialData|window\["ytInitialData"\]|window\.ytInitialData)\s*=\s*({[\s\S]*?})\s*;?\s*$/m,
      /ytInitialData\s*=\s*({[\s\S]*?})\s*;?\s*$/m,
      /"ytInitialData":\s*({[\s\S]*?})\s*,\s*"INNERTUBE/m,
    ];
    
    for (const pattern of patterns) {
      const match = scriptContent.match(pattern);
      if (match?.[1]) {
        try {
          return JSON.parse(match[1]);
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

function extractYtCfg(html: string): any | null {
  const m = html.match(/ytcfg\.set\(\s*({[\s\S]*?})\s*\)\s*;/);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  return null;
}

function extractMicroformat(html: string): any | null {
  const m = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?})\s*;?\s*$/m);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  
  const scripts = cheerio.load(html)("script").toArray();
  for (const script of scripts) {
    const content = cheerio.load(script)("script").html() || "";
    const match = content.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?})\s*;?\s*$/m);
    if (match?.[1]) {
      try {
        return JSON.parse(match[1]);
      } catch {}
    }
  }
  return null;
}

function extractRunsText(runs: any[] | undefined): string {
  if (!runs || !Array.isArray(runs)) return "";
  return runs.map((run) => run.text || run.string || "").join("");
}

function extractRichText(richText: any): string {
  if (!richText) return "";
  if (richText.runs && Array.isArray(richText.runs)) {
    return extractRunsText(richText.runs);
  }
  if (richText.simpleText) return richText.simpleText;
  return "";
}

function safeGet(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export async function scrapeYouTubeVideoPage(videoUrl: string): Promise<ScrapeVideoResult> {
  const startTime = Date.now();
  
  try {
    const urlMatch = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!urlMatch) {
      return { success: false, error: "Invalid YouTube URL" };
    }
    
    const videoId = urlMatch[1];
    
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const error = `Failed to fetch video page: ${response.status} ${response.statusText}`;
      await recordError({
        level: "warn",
        type: "scraper_video_page_fetch_failed",
        message: error,
        module: "video-scraper",
        url: videoUrl,
      });
      return { success: false, error };
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const initialData = extractInitialData(html);
    const ytcfg = extractYtCfg(html);
    const microformat = extractMicroformat(html);
    
    const result: ScrapedVideoDetails = {
      videoId,
      title: "",
      description: "",
      viewCount: "",
    };
    
    const scrapeDuration = Date.now() - startTime;
    let fieldsScraped = 0;
    let missingFields: string[] = [];
    
    const viewCountPatterns = [
      /"viewCountText"\s*:\s*"([^"]+)"/,
      /"viewCount[^"]*"[^}]*"defaultValue"\s*:\s*"([^"]+)"/,
      /views[^<]*<[^>]+>\s*([\d,]+\s*(?:views?|visualizaciones|vues|aufrufe))/i,
      /([\d,]+)\s*(?:views?| Aufrufe| 視聴| views)/i,
    ];
    
    for (const pattern of viewCountPatterns) {
      const match = html.match(pattern);
      if (match) {
        const raw = match[1] || match[0];
        const cleaned = raw.replace(/[^0-9]/g, "");
        if (cleaned.length >= 3) {
          result.viewCount = parseInt(cleaned, 10).toLocaleString();
          fieldsScraped++;
          break;
        }
      }
    }
    
    if (initialData) {
      const videoDetails = safeGet(initialData, "contents.twoColumnWatchNextResults.primaryResults.primaryResults.result.videoRenderer");
      const playerOverlay = safeGet(initialData, "contents.twoColumnWatchNextResults.videoPrimaryInfoRenderer");
      
      if (playerOverlay) {
        const titleRuns = playerOverlay.title?.runs;
        if (titleRuns) {
          result.title = extractRunsText(titleRuns);
          fieldsScraped++;
        } else {
          missingFields.push("title");
        }
        
        const viewCount = playerOverlay.viewCountVideoRenderer?.viewCount?.simpleText;
        if (viewCount) {
          result.viewCount = viewCount.replace(/[^0-9]/g, "") || viewCount;
          fieldsScraped++;
        } else {
          missingFields.push("viewCount");
        }
        
        const publishDate = playerOverlay.dateText?.simpleText;
        if (publishDate) {
          result.publishDate = publishDate;
          fieldsScraped++;
        }
        
        const descriptionRuns = playerOverlay.descriptionText?.runs;
        if (descriptionRuns) {
          result.description = extractRunsText(descriptionRuns);
          fieldsScraped++;
        } else {
          missingFields.push("description");
        }
        
        const keywordList = playerOverlay.keywords?.keyword;
        if (keywordList && Array.isArray(keywordList)) {
          result.keywords = keywordList.map((k: any) => 
            typeof k === "string" ? k : k.keyword || ""
          ).filter(Boolean);
          fieldsScraped++;
        }
      }
      
      if (videoDetails) {
        result.channelId = videoDetails.channelId;
        result.channelName = extractRichText(videoDetails.shortBylineText);
        result.channelUrl = videoDetails.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
        
        if (result.channelName) fieldsScraped++;
        
        if (!result.title) {
          result.title = extractRichText(videoDetails.title);
          if (result.title) fieldsScraped++;
        }
        
        if (!result.description) {
          result.description = extractRunsText(videoDetails.descriptionSnippet?.runs);
          if (result.description) fieldsScraped++;
        }
      }
      
      const secondaryInfo = safeGet(initialData, "contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.result");
      if (secondaryInfo && !result.description) {
        const expandableMetadata = secondaryInfo.expandableVideoDescriptionSectionRenderer?.rows;
        if (expandableMetadata && Array.isArray(expandableMetadata)) {
          for (const row of expandableMetadata) {
            if (row.videoDescriptionHeaderRenderer) {
              const header = row.videoDescriptionHeaderRenderer;
              if (!result.title) {
                result.title = extractRunsText(header.title?.runs);
              }
              if (!result.channelName) {
                result.channelName = extractRunsText(header.channelTitle?.runs);
              }
              if (!result.description) {
                result.description = extractRunsText(header.description?.runs);
              }
            }
          }
        }
        
        const macroMarkersList = secondaryInfo.macroMarkersListRenderer?.contents;
        if (macroMarkersList && Array.isArray(macroMarkersList) && !result.keywords?.length) {
          const keywords: string[] = [];
          for (const marker of macroMarkersList) {
            const text = marker.macroMarkersListItemRenderer?.title?.simpleText;
            if (text) keywords.push(text);
          }
          if (keywords.length > 0) {
            result.keywords = keywords;
            fieldsScraped++;
          }
        }
      }
    }
    
    if (microformat) {
      const videoDetails = microformat.videoDetails;
      if (videoDetails) {
        if (!result.title && videoDetails.title) {
          result.title = videoDetails.title;
          fieldsScraped++;
        }
        
        if (!result.description && videoDetails.shortDescription) {
          result.description = videoDetails.shortDescription;
          fieldsScraped++;
        }
        
        if (!result.viewCount && videoDetails.viewCount) {
          result.viewCount = Number(videoDetails.viewCount).toLocaleString();
          fieldsScraped++;
        }
        
        if (!result.channelName && videoDetails.author) {
          result.channelName = videoDetails.author;
          fieldsScraped++;
        }
        
        if (!result.channelId && videoDetails.channelId) {
          result.channelId = videoDetails.channelId;
        }
        
        if (videoDetails.keywords && videoDetails.keywords.length > 0) {
          result.keywords = videoDetails.keywords;
          fieldsScraped++;
        }
        
        if (!result.category && videoDetails.category) {
          result.category = videoDetails.category;
          fieldsScraped++;
        }
        
        if (videoDetails.isLiveContent) {
          result.isLive = true;
        }
        
        if (!result.duration && videoDetails.lengthSeconds) {
          const seconds = parseInt(videoDetails.lengthSeconds, 10);
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          result.duration = hours > 0 
            ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
            : `${minutes}:${secs.toString().padStart(2, "0")}`;
          fieldsScraped++;
        }
      }
      
      const streamingData = microformat.streamingData;
      if (streamingData) {
        result.isShort = streamingData.formats?.some((f: any) => 
          f.qualityLabel?.includes("720p") && !streamingData.formats?.some((g: any) => g.qualityLabel?.includes("1080p"))
        );
      }
    }
    
    const ogTitle = $('meta[property="og:title"]').attr("content");
    if (ogTitle && !result.title) {
      result.title = ogTitle;
      missingFields.push("title");
    }
    
    const ogDescription = $('meta[property="og:description"]').attr("content");
    if (ogDescription && !result.description) {
      result.description = ogDescription;
      missingFields.push("description");
    }
    
    result.thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    
    const isShortUrl = videoUrl.includes("/shorts/");
    if (isShortUrl) {
      result.isShort = true;
    }
    
    const requiredFields = ["title", "description", "viewCount"];
    const missingRequired = requiredFields.filter(f => !result[f as keyof ScrapedVideoDetails]);
    
    if (missingRequired.length > 0) {
      logger.warn(`[video-scraper] Partial data for ${videoId}: missing ${missingRequired.join(", ")}`);
      logger.warn(`[video-scraper] Fields scraped: ${fieldsScraped}, Duration: ${Date.now() - startTime}ms`);
      
      await recordError({
        level: "warn",
        type: "scraper_video_partial_data",
        message: `Incomplete video data: missing ${missingRequired.join(", ")}`,
        module: "video-scraper",
        url: videoUrl,
        context: {
          videoId,
          fieldsScraped,
          missingFields: missingRequired,
          durationMs: Date.now() - startTime,
          hasInitialData: !!initialData,
          hasMicroformat: !!microformat,
        },
      });
    }
    
    if (!result.title) {
      return {
        success: false,
        error: "Could not extract video title",
        partial: result.description !== "",
      };
    }
    
    logger.info(`[video-scraper] Scraped ${videoId}: "${result.title.substring(0, 50)}..." - ${fieldsScraped} fields in ${Date.now() - startTime}ms`);
    
    return {
      success: true,
      data: result,
      partial: missingRequired.length > 0,
    };
    
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    
    await recordError({
      level: "error",
      type: "scraper_video_page_error",
      message,
      module: "video-scraper",
      url: videoUrl,
      stack: error?.stack,
    });
    
    logger.error(`[video-scraper] Error scraping ${videoUrl}:`, error);
    
    return {
      success: false,
      error: message,
    };
  }
}

export async function scrapeMultipleVideos(videoUrls: string[]): Promise<Map<string, ScrapeVideoResult>> {
  const results = new Map<string, ScrapeVideoResult>();
  
  const concurrencyLimit = 3;
  const queue = [...videoUrls];
  const running: Promise<void>[] = [];
  
  const scrape = async (url: string) => {
    const result = await scrapeYouTubeVideoPage(url);
    results.set(url, result);
  };
  
  while (queue.length > 0 || running.length > 0) {
    while (running.length < concurrencyLimit && queue.length > 0) {
      const url = queue.shift()!;
      const promise = scrape(url).then(() => {
        const idx = running.indexOf(promise);
        if (idx > -1) running.splice(idx, 1);
      });
      running.push(promise);
    }
    
    if (running.length > 0) {
      await Promise.race(running);
    }
  }
  
  return results;
}
