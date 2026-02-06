import { recordError } from "./error-log-service.js";

export interface ScrapedTikTokVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration?: string;
  viewCount?: string;
  publishDate?: string;
  embedUrl: string;
  videoType: "tiktok";
}

export interface ScrapedTikTokProfile {
  username: string;
  displayName: string;
  avatarUrl?: string;
  followerCount?: string;
  videoCount?: string;
}

export async function scrapeTikTokProfile(profileUrl: string): Promise<{
  profileInfo: ScrapedTikTokProfile;
  videos: ScrapedTikTokVideo[];
}> {
  if (process.env.VERCEL === '1') {
    const error = new Error("TikTok scraping is not supported in Vercel serverless environment due to browser dependencies.");
    await recordError({
      level: "warn",
      type: "tiktok_scraper_skipped",
      message: error.message,
      module: "tiktok-scraper",
      url: profileUrl
    });
    throw error;
  }

  let browser;
  try {
    const { default: puppeteer } = await import("puppeteer-extra");
    const { default: StealthPlugin } = await import("puppeteer-extra-plugin-stealth");
    
    puppeteer.use(StealthPlugin());

    const username = extractUsername(profileUrl);
    if (!username) {
      throw new Error("Invalid TikTok profile URL");
    }

    const normalizedUrl = `https://www.tiktok.com/@${username}`;
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(normalizedUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await page.waitForSelector('[data-e2e="user-post-item"]', { timeout: 15000 }).catch(() => {
      console.log("No video items found, profile might be empty or blocked");
    });

    const pageContent = await page.content();
    
    const sigiStateMatch = pageContent.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/);
    let sigiData: any = null;
    
    if (sigiStateMatch) {
      try {
        sigiData = JSON.parse(sigiStateMatch[1]);
      } catch (e) {
        console.log("Failed to parse SIGI_STATE data");
      }
    }

    const profileInfo: ScrapedTikTokProfile = {
      username,
      displayName: username,
    };
    const videos: ScrapedTikTokVideo[] = [];

    if (sigiData) {
      const defaultScope = sigiData["__DEFAULT_SCOPE__"];
      const userDetail = defaultScope?.["webapp.user-detail"];
      const userInfo = userDetail?.userInfo?.user;
      const stats = userDetail?.userInfo?.stats;
      
      if (userInfo) {
        profileInfo.displayName = userInfo.nickname || username;
        profileInfo.avatarUrl = userInfo.avatarLarger || userInfo.avatarMedium || userInfo.avatarThumb;
      }
      
      if (stats) {
        profileInfo.followerCount = formatCount(stats.followerCount);
        profileInfo.videoCount = String(stats.videoCount || 0);
      }

      const itemModule = defaultScope?.["webapp.user-detail"]?.itemList || [];
      
      for (const item of itemModule.slice(0, 30)) {
        const videoId = item.id;
        if (!videoId) continue;

        const video: ScrapedTikTokVideo = {
          videoId,
          title: item.desc || `TikTok video by @${username}`,
          description: item.desc || "",
          thumbnailUrl: item.video?.cover || item.video?.dynamicCover || "",
          duration: formatDuration(item.video?.duration),
          viewCount: formatCount(item.stats?.playCount),
          publishDate: formatTimestamp(item.createTime),
          embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
          videoType: "tiktok",
        };

        if (video.videoId && video.thumbnailUrl) {
          videos.push(video);
        }
      }
    }

    if (videos.length === 0) {
      const videoElements = await page.$$eval('[data-e2e="user-post-item"]', (items) => {
        return items.slice(0, 30).map((item) => {
          const link = item.querySelector("a");
          const img = item.querySelector("img");
          const href = link?.getAttribute("href") || "";
          const videoIdMatch = href.match(/\/video\/(\d+)/);
          
          return {
            videoId: videoIdMatch?.[1] || "",
            thumbnailUrl: img?.getAttribute("src") || "",
            title: img?.getAttribute("alt") || "",
          };
        });
      });

      for (const el of videoElements) {
        if (el.videoId) {
          videos.push({
            videoId: el.videoId,
            title: el.title || `TikTok video by @${username}`,
            description: "",
            thumbnailUrl: el.thumbnailUrl,
            embedUrl: `https://www.tiktok.com/embed/v2/${el.videoId}`,
            videoType: "tiktok",
          });
        }
      }
    }

    return { profileInfo, videos };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[tiktok-scraper] Scraping error:", errorMessage);
    await recordError({
      level: "error",
      type: "tiktok_scraper_failed",
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      module: "tiktok-scraper",
      url: profileUrl
    });
    throw new Error(`Failed to scrape TikTok profile: ${errorMessage}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("[tiktok-scraper] Error closing browser:", closeError);
      }
    }
  }
}

function extractUsername(url: string): string | null {
  const match = url.match(/tiktok\.com\/@([^/?]+)/);
  if (match) return match[1];
  
  if (url.startsWith("@")) return url.slice(1);
  if (!url.includes("/") && !url.includes(".")) return url;
  
  return null;
}

function formatCount(count: number | undefined): string | undefined {
  if (count === undefined) return undefined;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

function formatDuration(seconds: number | undefined): string | undefined {
  if (!seconds) return undefined;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimestamp(timestamp: number | undefined): string | undefined {
  if (!timestamp) return undefined;
  const date = new Date(timestamp * 1000);
  return date.toISOString().split("T")[0];
}
