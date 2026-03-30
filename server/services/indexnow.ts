const INDEXNOW_KEY = "c357aac9b13401a2c0b03d34ff781820";
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[indexnow] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[indexnow] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[indexnow] ${msg}`, ...args),
};

// Batch queue for URLs to submit
let pendingUrls: string[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_DELAY_MS = 10_000; // Wait 10s to batch multiple URLs together
const MAX_BATCH_SIZE = 100;

/**
 * Returns the IndexNow API key
 */
export function getIndexNowKey(): string {
  return INDEXNOW_KEY;
}

/**
 * Submit a single URL to IndexNow (batched)
 */
export function submitUrl(url: string): void {
  pendingUrls.push(url);

  if (pendingUrls.length >= MAX_BATCH_SIZE) {
    flushBatch();
    return;
  }

  if (!batchTimer) {
    batchTimer = setTimeout(() => flushBatch(), BATCH_DELAY_MS);
  }
}

/**
 * Submit multiple URLs to IndexNow (batched)
 */
export function submitUrls(urls: string[]): void {
  pendingUrls.push(...urls);

  if (pendingUrls.length >= MAX_BATCH_SIZE) {
    flushBatch();
    return;
  }

  if (!batchTimer) {
    batchTimer = setTimeout(() => flushBatch(), BATCH_DELAY_MS);
  }
}

/**
 * Notify IndexNow about a new or updated video
 */
export function notifyVideoChange(videoSlugOrId: string): void {
  const baseUrl = process.env.PUBLIC_BASE_URL || "https://nisam.video";
  submitUrl(`${baseUrl}/video/${videoSlugOrId}`);
}

/**
 * Notify IndexNow about a new or updated channel
 */
export function notifyChannelChange(channelSlug: string): void {
  const baseUrl = process.env.PUBLIC_BASE_URL || "https://nisam.video";
  submitUrl(`${baseUrl}/channels/${channelSlug}`);
}

/**
 * Flush the batch of pending URLs to all IndexNow endpoints
 */
async function flushBatch(): Promise<void> {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  if (pendingUrls.length === 0) return;

  // Deduplicate
  const urls = [...new Set(pendingUrls)];
  pendingUrls = [];

  const baseUrl = process.env.PUBLIC_BASE_URL || "https://nisam.video";
  const host = new URL(baseUrl).host;

  logger.info(`Submitting ${urls.length} URL(s) to IndexNow`);

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${baseUrl}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, 10000), // IndexNow max is 10,000
  };

  // Submit to all endpoints in parallel
  const results = await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map(async (endpoint) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok || res.status === 202) {
          logger.info(`Submitted to ${endpoint}: ${res.status}`);
        } else {
          logger.warn(`${endpoint} responded ${res.status}: ${await res.text().catch(() => "")}`);
        }
      } catch (err) {
        logger.error(`Failed to submit to ${endpoint}:`, err);
      }
    })
  );
}

/**
 * Submit the sitemap URL to IndexNow endpoints
 */
export async function submitSitemap(): Promise<void> {
  const baseUrl = process.env.PUBLIC_BASE_URL || "https://nisam.video";
  const sitemapUrl = `${baseUrl}/sitemap.xml`;

  // Google and Bing sitemap ping endpoints
  const pingEndpoints = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];

  logger.info("Pinging search engines with sitemap URL");

  await Promise.allSettled(
    pingEndpoints.map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        logger.info(`Sitemap ping ${url.split("?")[0]}: ${res.status}`);
      } catch (err) {
        logger.error(`Sitemap ping failed for ${url}:`, err);
      }
    })
  );
}
