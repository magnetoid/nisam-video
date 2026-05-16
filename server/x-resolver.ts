// X (Twitter) single-video resolver.
//
// Resolves a single X post URL into normalized video metadata using two public,
// unauthenticated endpoints:
//
//   1. https://cdn.syndication.twimg.com/tweet-result  (powers X's embed widget)
//      → JSON with mediaDetails[], author, created_at, video_info.variants[]
//   2. https://publish.twitter.com/oembed              (official, documented)
//      → embed HTML; called in parallel with (1) on the happy path.
//
// Posts that do not contain a native video (photo-only, text-only, or video
// with no mp4 variant) are rejected — this module's contract is
// "playable video posts only".

import { recordError } from "./error-log-service.js";

export interface ResolvedXVideo {
  /** Tweet ID (numeric string) */
  videoId: string;
  /** Canonical tweet URL on x.com */
  permanentUrl: string;
  /** Tweet text used as the title (truncated to first line, grapheme-safe). */
  title: string;
  /** Full tweet text used as description. */
  description: string;
  /** Direct mp4 URL of the highest-bitrate variant. Guaranteed non-empty. */
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

const TWEET_URL_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,20})\/status(?:es)?\/(\d{1,32})(?:\/|\?|#|$)/i;
const DEFAULT_TIMEOUT_MS = 8000;
// Defensive cap on upstream response body. The real responses are <50KB; this
// stops a compromised/misconfigured CDN from filling memory.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export function extractTweetId(url: string): string | null {
  const trimmed = url.trim();
  const m = TWEET_URL_RE.exec(trimmed);
  return m ? m[2] : null;
}

function extractHandleFromUrl(url: string): string | null {
  const trimmed = url.trim();
  const m = TWEET_URL_RE.exec(trimmed);
  return m ? m[1] : null;
}

// Token generation used by X's embed widget — derived from the tweet ID.
// Reverse-engineered from publish.twitter.com's widget bundle (same approach
// used by vercel/react-tweet). Token is an anti-abuse signal, not a per-tweet
// identifier — the syndication endpoint resolves by the `id=` param.
export function syndicationToken(tweetId: string): string {
  const n = Number(tweetId);
  if (!Number.isFinite(n) || n <= 0) {
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
    const declared = parseInt(res.headers.get("content-length") || "0", 10);
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      return null;
    }
    const text = await res.text();
    // Syndication endpoint sometimes returns a 200 with an empty body.
    if (!text) return null;
    if (text.length > MAX_RESPONSE_BYTES) return null;
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
  __typename?: string;
}

function pickBestMp4(variants: SyndicationVariant[] | undefined): string {
  if (!variants || variants.length === 0) return "";
  const mp4s = variants
    .filter((v) => (v.content_type ?? "").toLowerCase() === "video/mp4" && v.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4s[0]?.url ?? "";
}

// Grapheme-safe first-line truncation. JS string.length counts UTF-16 code
// units, so slicing at `max` can split a surrogate pair (emoji) or a CJK
// composed character. Spreading into an array yields code points instead.
function firstLine(text: string, max = 120): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const chars = Array.from(first);
  if (chars.length <= max) return first;
  return chars.slice(0, max - 1).join("") + "…";
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

function sanitizeUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "<unparseable>";
  }
}

/**
 * Resolve a single X tweet URL into normalized video metadata.
 * Throws if the URL is not a valid X post, the post contains no video,
 * or the only video variants are HLS/m3u8 (no playable mp4).
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

  // Best-effort canonical URL from the source URL itself — lets us fire
  // oEmbed in parallel with the syndication call. We replace it with the
  // post-response canonical (preferring the upstream-reported handle) if we
  // get one back.
  const handleFromUrl = extractHandleFromUrl(url) ?? "i";
  const preliminaryCanonical = `https://x.com/${handleFromUrl}/status/${tweetId}`;

  const [tweet, oEmbedInitial] = await Promise.all([
    fetchJson<SyndicationTweet>(syndicationUrl),
    fetchOEmbed(preliminaryCanonical),
  ]);

  if (!tweet || !tweet.mediaDetails) {
    // Retry once with cache-bust — the endpoint occasionally returns 200 with
    // an empty body. Sequential here is intentional (already paid one RTT).
    const retry = await fetchJson<SyndicationTweet>(
      `${syndicationUrl}&_=${Date.now()}`,
    );
    if (retry && retry.mediaDetails) {
      const correctedCanonical = canonicalTweetUrl(tweetId, retry);
      const oEmbed = correctedCanonical === preliminaryCanonical
        ? oEmbedInitial
        : await fetchOEmbed(correctedCanonical);
      return finalize(retry, tweetId, oEmbed);
    }
    await recordError({
      level: "warn",
      type: "x_resolver_syndication_empty",
      message: "Syndication endpoint returned no media for tweet",
      module: "x-resolver",
      url: sanitizeUrlForLog(url),
    });
    throw new Error("Could not load tweet data from X. The post may be private, deleted, or temporarily unavailable.");
  }

  return finalize(tweet, tweetId, oEmbedInitial);
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
    // Photo-only, GIF-only, or text-only posts are rejected by contract.
    throw new Error("This X post does not contain a video. Only video posts are supported.");
  }

  const videoUrl = pickBestMp4(videoMedia.video_info?.variants);
  if (!videoUrl) {
    // Some video posts only expose HLS/m3u8 variants — we can't store those
    // as a directly-embeddable mp4. Reject so the admin gets a clear message
    // instead of a broken player downstream.
    throw new Error("This X post's video is HLS-only or unsupported; no playable mp4 variant found.");
  }

  const text = tweet.full_text ?? tweet.text ?? "";
  const title = firstLine(text) || `X video ${tweetId}`;
  const description = text;
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
