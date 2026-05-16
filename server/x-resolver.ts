// X (Twitter) single-video resolver.
//
// Resolves a single X post URL into normalized video metadata using two public,
// unauthenticated endpoints:
//
//   1. https://cdn.syndication.twimg.com/tweet-result  (powers X's embed widget)
//      → JSON with mediaDetails[], author, created_at, video_info.variants[]
//   2. https://publish.twitter.com/oembed              (official, documented)
//      → fallback HTML embed when (1) fails or returns no media
//
// Posts that do not contain a native video (photo-only, text-only) are rejected
// — this module's contract is "video posts only".

import { recordError } from "./error-log-service.js";

export interface ResolvedXVideo {
  /** Tweet ID (numeric string) */
  videoId: string;
  /** Canonical tweet URL on x.com */
  permanentUrl: string;
  /** Tweet text used as the title (truncated to first line). */
  title: string;
  /** Full tweet text used as description. */
  description: string;
  /** Direct mp4 URL of the highest-bitrate variant. May be empty if only HLS was returned. */
  videoUrl: string;
  /** Thumbnail (poster) image URL. */
  thumbnailUrl: string;
  /** Duration in seconds (rounded) or undefined if unknown. */
  durationSeconds?: number;
  /** ISO-8601 publish date or undefined. */
  publishDate?: string;
  /** Embed HTML from oEmbed/widgets when available (frontend uses this for the player). */
  embedHtml?: string;
  /** X username (screen_name) of the author. */
  authorScreenName?: string;
  /** Display name of the author. */
  authorName?: string;
}

const TWEET_URL_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,20}\/status(?:es)?\/(\d{1,32})(?:\/|\?|#|$)/i;
const DEFAULT_TIMEOUT_MS = 8000;

export function extractTweetId(url: string): string | null {
  const trimmed = url.trim();
  const m = TWEET_URL_RE.exec(trimmed);
  return m ? m[1] : null;
}

// Token generation used by X's embed widget — derived from the tweet ID.
// Reverse-engineered from publish.twitter.com's widget bundle (same approach
// used by vercel/react-tweet). Token is required by the syndication endpoint.
export function syndicationToken(tweetId: string): string {
  const n = Number(tweetId);
  if (!Number.isFinite(n) || n <= 0) {
    // Fallback to a static-ish token; the endpoint accepts any non-empty string
    // for some tweets but the derived form is what the embed widget uses.
    return "1";
  }
  return ((n / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, "");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; nisam-video/1.0)",
        Accept: "application/json, text/plain, */*",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Syndication endpoint sometimes returns a 200 with an empty body.
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

interface SyndicationVariant {
  bitrate?: number;
  content_type?: string;
  url: string;
}

interface SyndicationMediaDetail {
  type: "photo" | "video" | "animated_gif";
  media_url_https: string;
  video_info?: {
    duration_millis?: number;
    variants?: SyndicationVariant[];
  };
}

interface SyndicationTweet {
  id_str?: string;
  text?: string;
  full_text?: string;
  created_at?: string;
  user?: {
    name?: string;
    screen_name?: string;
  };
  mediaDetails?: SyndicationMediaDetail[];
  // Newer responses sometimes nest under "tweet" / "data"
  __typename?: string;
}

function pickBestMp4(variants: SyndicationVariant[] | undefined): string {
  if (!variants || variants.length === 0) return "";
  const mp4s = variants
    .filter((v) => (v.content_type ?? "").toLowerCase() === "video/mp4" && v.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4s[0]?.url ?? "";
}

function firstLine(text: string, max = 120): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  return first.length <= max ? first : first.slice(0, max - 1) + "…";
}

function toIsoDate(twitterDate: string | undefined): string | undefined {
  if (!twitterDate) return undefined;
  const d = new Date(twitterDate);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface OEmbedResponse {
  html?: string;
  author_name?: string;
  author_url?: string;
  url?: string;
}

async function fetchOEmbed(tweetUrl: string): Promise<OEmbedResponse | null> {
  const params = new URLSearchParams({
    url: tweetUrl,
    omit_script: "true",
    hide_thread: "true",
    dnt: "true",
  });
  return fetchJson<OEmbedResponse>(`https://publish.twitter.com/oembed?${params.toString()}`);
}

/**
 * Resolve a single X tweet URL into normalized video metadata.
 * Throws if the URL is not a valid X post or if the post contains no video.
 */
export async function resolveXVideo(url: string): Promise<ResolvedXVideo> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    throw new Error("Not a valid X post URL");
  }

  const token = syndicationToken(tweetId);
  const syndicationUrl =
    `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(tweetId)}` +
    `&token=${encodeURIComponent(token)}&lang=en`;

  const tweet = await fetchJson<SyndicationTweet>(syndicationUrl);

  // Run oEmbed in parallel-ish — fire only if we still need embed HTML below.
  let oEmbed: OEmbedResponse | null = null;

  if (!tweet || !tweet.mediaDetails) {
    // Try one more time with a freshly generated token (the endpoint is flaky).
    const retry = await fetchJson<SyndicationTweet>(
      `${syndicationUrl}&_=${Date.now()}`,
    );
    if (retry && retry.mediaDetails) {
      return finalize(retry, tweetId, await fetchOEmbed(canonicalTweetUrl(tweetId, retry)));
    }
    await recordError({
      level: "warn",
      type: "x_resolver_syndication_empty",
      message: "Syndication endpoint returned no media for tweet",
      module: "x-resolver",
      url,
    });
    throw new Error("Could not load tweet data from X. The post may be private, deleted, or temporarily unavailable.");
  }

  oEmbed = await fetchOEmbed(canonicalTweetUrl(tweetId, tweet));
  return finalize(tweet, tweetId, oEmbed);
}

function canonicalTweetUrl(tweetId: string, tweet: SyndicationTweet): string {
  const handle = tweet.user?.screen_name?.replace(/^@/, "") ?? "i";
  return `https://x.com/${handle}/status/${tweetId}`;
}

function finalize(
  tweet: SyndicationTweet,
  tweetId: string,
  oEmbed: OEmbedResponse | null,
): ResolvedXVideo {
  const videoMedia = (tweet.mediaDetails ?? []).find((m) => m.type === "video");
  if (!videoMedia) {
    // Photo-only or text-only posts are rejected by contract.
    throw new Error("This X post does not contain a video. Only video posts are supported.");
  }

  const text = tweet.full_text ?? tweet.text ?? "";
  const title = firstLine(text) || `X video ${tweetId}`;
  const description = text;
  const videoUrl = pickBestMp4(videoMedia.video_info?.variants);
  const thumbnailUrl = videoMedia.media_url_https;
  const durationMs = videoMedia.video_info?.duration_millis;
  const durationSeconds = durationMs ? Math.max(1, Math.round(durationMs / 1000)) : undefined;

  return {
    videoId: tweetId,
    permanentUrl: canonicalTweetUrl(tweetId, tweet),
    title,
    description,
    videoUrl,
    thumbnailUrl,
    durationSeconds,
    publishDate: toIsoDate(tweet.created_at),
    embedHtml: oEmbed?.html,
    authorScreenName: tweet.user?.screen_name,
    authorName: tweet.user?.name ?? oEmbed?.author_name,
  };
}
