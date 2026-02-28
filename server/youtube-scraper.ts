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
  videoType: "regular" | "youtube_short";
}

export interface ScrapedChannelInfo {
  channelName?: string;
  channelId?: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
}

function detectYouTubeShort(videoRenderer: any): boolean {
  const navigationEndpoint = videoRenderer?.navigationEndpoint;
  if (
    navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.includes(
      "/shorts/",
    )
  ) {
    return true;
  }

  const overlayStyle = videoRenderer?.thumbnailOverlays?.find(
    (overlay: any) =>
      overlay?.thumbnailOverlayTimeStatusRenderer?.style === "SHORTS",
  );
  if (overlayStyle) return true;
  return false;
}

function extractInitialData(html: string): any | null {
  const $ = cheerio.load(html);
  const scriptTags = $("script").toArray();
  for (const script of scriptTags) {
    const scriptContent = $(script).html() || "";
    const match = scriptContent.match(
      /(?:var\s+ytInitialData|window\["ytInitialData"\]|window\.ytInitialData)\s*=\s*({.*?});/,
    );
    if (match?.[1]) {
      try {
        return JSON.parse(match[1]);
      } catch {
      }
    }
  }
  return null;
}

function extractYtCfgFromHtml(html: string): any | null {
  const m = html.match(/ytcfg\.set\(\s*({[\s\S]*?})\s*\)\s*;/);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1]);
    } catch {
    }
  }

  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const clientName = html.match(/"INNERTUBE_CONTEXT_CLIENT_NAME":(\d+)/)?.[1];
  const clientVersion = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)?.[1];
  const visitorData = html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1];

  if (!apiKey && !clientVersion) return null;
  return {
    INNERTUBE_API_KEY: apiKey,
    INNERTUBE_CONTEXT_CLIENT_NAME: clientName ? Number(clientName) : undefined,
    INNERTUBE_CONTEXT_CLIENT_VERSION: clientVersion,
    VISITOR_DATA: visitorData,
  };
}

function findFirstRichGridContents(root: any): any[] {
  const stack: any[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    const rg = (node as any).richGridRenderer;
    if (rg?.contents && Array.isArray(rg.contents)) return rg.contents;

    for (const v of Object.values(node)) {
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return [];
}

function getVideosTabItems(initialData: any): any[] {
  const tabs = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs;
  if (Array.isArray(tabs)) {
    for (const tab of tabs) {
      const tr = tab?.tabRenderer;
      const direct = tr?.content?.richGridRenderer?.contents;
      if (Array.isArray(direct) && direct.length) return direct;
      const deep = findFirstRichGridContents(tr?.content);
      if (deep.length) return deep;
    }
  }
  return findFirstRichGridContents(initialData);
}

function extractContinuationToken(items: any[]): string | undefined {
  for (const it of items) {
    const token =
      it?.continuationItemRenderer?.continuationEndpoint?.continuationCommand
        ?.token;
    if (typeof token === "string" && token) return token;
  }
  return undefined;
}

function extractContinuationItems(respJson: any): any[] {
  const actions =
    respJson?.onResponseReceivedActions ??
    respJson?.onResponseReceivedEndpoints ??
    [];
  for (const a of actions) {
    const items =
      a?.appendContinuationItemsAction?.continuationItems ??
      a?.reloadContinuationItemsCommand?.continuationItems;
    if (Array.isArray(items)) return items;
  }
  return [];
}

function extractVideoRenderer(item: any): any | null {
  return (
    item?.richItemRenderer?.content?.videoRenderer ??
    item?.itemSectionRenderer?.contents?.[0]?.videoRenderer ??
    null
  );
}

export async function scrapeYouTubeChannelAbout(channelUrl: string): Promise<ScrapedChannelInfo> {
  const normalized = channelUrl.replace(/\/+$/, "");
  const response = await fetch(normalized, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const err = new Error(
      `Failed to fetch channel: ${response.status} ${response.statusText}`,
    ) as any;
    err.statusCode = response.status;
    throw err;
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const channelInfo: ScrapedChannelInfo = {};

  const initialData = extractInitialData(html);

  const metaDesc =
    $("meta[name=\"description\"]").attr("content") ||
    $("meta[property=\"og:description\"]").attr("content");
  if (metaDesc) channelInfo.description = metaDesc;

  if (initialData) {
    const header =
      initialData?.header?.c4TabbedHeaderRenderer ||
      initialData?.header?.pageHeaderRenderer;
    if (header) {
      channelInfo.channelName = header.title || header.pageTitle;
      channelInfo.channelId = header.channelId;

      const avatarThumbs =
        header.avatar?.thumbnails || header.content?.image?.thumbnails;
      if (avatarThumbs?.length > 0) {
        channelInfo.thumbnailUrl = avatarThumbs[0].url;
      }

      const bannerThumbs =
        header.banner?.thumbnails || header.content?.banner?.thumbnails;
      if (bannerThumbs?.length > 0) {
        channelInfo.bannerUrl = bannerThumbs[bannerThumbs.length - 1].url;
      }
    }

    const metadataDesc =
      initialData?.metadata?.channelMetadataRenderer?.description ||
      initialData?.microformat?.microformatDataRenderer?.description;
    if (typeof metadataDesc === "string" && metadataDesc.trim()) {
      channelInfo.description = metadataDesc;
    }
  }

  return channelInfo;
}

export async function scrapeYouTubeChannel(
  channelUrl: string,
  options: {
    existingVideoIds?: Set<string>;
    incremental?: boolean;
    maxItems?: number;
  } = {},
): Promise<{ channelInfo: ScrapedChannelInfo; videos: ScrapedVideo[] }> {
  try {
    const normalized = channelUrl.replace(/\/+$/, "");
    const targetUrl = normalized.includes("/shorts")
      ? normalized
      : `${normalized}/videos?view=0&sort=dd&flow=grid`;

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const err = new Error(
        `Failed to fetch channel: ${response.status} ${response.statusText}`,
      ) as any;
      err.statusCode = response.status;
      throw err;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const initialData = extractInitialData(html);
    const ytcfg = extractYtCfgFromHtml(html);

    const channelInfo: ScrapedChannelInfo = {};
    const videos: ScrapedVideo[] = [];
    const maxItems = Math.max(1, Math.min(200, options.maxItems ?? 60));

    if (!initialData) {
      const ogTitle = $("meta[property=\"og:title\"]").attr("content");
      const ogImage = $("meta[property=\"og:image\"]").attr("content");

      if (ogTitle) channelInfo.channelName = ogTitle;
      if (ogImage) channelInfo.thumbnailUrl = ogImage;

      await recordError({
        level: "warn",
        type: "scraper_partial_data",
        message:
          "Could not parse ytInitialData for /videos page, falling back to meta tags for channel info",
        module: "youtube-scraper",
        url: channelUrl,
      });

      return { channelInfo, videos };
    }

    const header =
      initialData?.header?.c4TabbedHeaderRenderer ||
      initialData?.header?.pageHeaderRenderer;
    if (header) {
      channelInfo.channelName = header.title || header.pageTitle;
      channelInfo.channelId = header.channelId;
      const thumbnails = header.avatar?.thumbnails || header.content?.image?.thumbnails;
      if (thumbnails?.length > 0) {
        channelInfo.thumbnailUrl = thumbnails[0].url;
      }

      const bannerThumbs = header.banner?.thumbnails || header.content?.banner?.thumbnails;
      if (bannerThumbs?.length > 0) {
        channelInfo.bannerUrl = bannerThumbs[bannerThumbs.length - 1].url;
      }
    }

    const metadataDesc =
      initialData?.metadata?.channelMetadataRenderer?.description ||
      initialData?.microformat?.microformatDataRenderer?.description;
    if (typeof metadataDesc === "string" && metadataDesc.trim()) {
      channelInfo.description = metadataDesc.replace(/\s+/g, " ").trim();
    }

    const seenVideoIds = new Set<string>();
    let scanned = 0;

    const scanItems = (items: any[]) => {
      for (const it of items) {
        if (scanned >= maxItems) break;
        const renderer = extractVideoRenderer(it);
        if (!renderer) continue;

        const videoId = renderer.videoId;
        if (!videoId || typeof videoId !== "string") continue;
        if (seenVideoIds.has(videoId)) continue;
        seenVideoIds.add(videoId);
        scanned += 1;

        if (options.incremental && options.existingVideoIds?.has(videoId)) {
          continue;
        }

        const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const duration = renderer.lengthText?.simpleText;
        const isShort = detectYouTubeShort(renderer);

        const video: ScrapedVideo = {
          videoId,
          title: renderer.title?.runs?.[0]?.text || "",
          description: renderer.descriptionSnippet?.runs?.[0]?.text || "",
          thumbnailUrl,
          duration,
          viewCount: renderer.viewCountText?.simpleText,
          publishDate: renderer.publishedTimeText?.simpleText,
          videoType: isShort ? "youtube_short" : "regular",
        };

        if (video.title) videos.push(video);
      }
    };

    let items = getVideosTabItems(initialData);
    scanItems(items);

    let continuation = extractContinuationToken(items);
    const apiKey: string | undefined = ytcfg?.INNERTUBE_API_KEY;
    const clientNameHeader = String(ytcfg?.INNERTUBE_CONTEXT_CLIENT_NAME ?? 1);
    const clientVersion = ytcfg?.INNERTUBE_CONTEXT_CLIENT_VERSION;
    const visitorData = ytcfg?.VISITOR_DATA;
    const context = clientVersion
      ? {
          client: {
            clientName: "WEB",
            clientVersion,
            ...(visitorData ? { visitorData } : {}),
          },
        }
      : undefined;

    const maxPages = 10;
    let pages = 0;

    while (scanned < maxItems && continuation && apiKey && context && pages < maxPages) {
      pages += 1;
      const contRes = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://www.youtube.com",
            "x-youtube-client-name": clientNameHeader,
            ...(clientVersion ? { "x-youtube-client-version": clientVersion } : {}),
            ...(visitorData ? { "x-goog-visitor-id": visitorData } : {}),
          },
          body: JSON.stringify({ context, continuation }),
          signal: AbortSignal.timeout(20000),
        },
      );

      if (!contRes.ok) break;
      const contJson = await contRes.json();
      const contItems = extractContinuationItems(contJson);
      if (!contItems.length) break;

      scanItems(contItems);
      continuation = extractContinuationToken(contItems);
    }

    if (!channelInfo.channelName && videos.length === 0) {
      throw new Error("No channel info or videos found in scraped data");
    }

    return { channelInfo, videos };
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === "number" ? error.statusCode : undefined;
    const message = error instanceof Error ? error.message : String(error);
    const isNotFound = statusCode === 404 || message.includes("Failed to fetch channel: 404");

    if (isNotFound) {
      await recordError({
        level: "warn",
        type: "scraper_not_found",
        message,
        module: "youtube-scraper",
        url: channelUrl,
      });
      return { channelInfo: {}, videos: [] };
    }

    await recordError({
      level: "error",
      type: "scraper_failure",
      message,
      module: "youtube-scraper",
      url: channelUrl,
    });

    throw error;
  }
}
