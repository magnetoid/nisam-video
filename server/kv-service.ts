import { kvStorage as kvStore } from './storage/kv.js';
import { storage } from './storage.js';
import { getRedisClient } from './services/redis.js';

/**
 * KV Store Service for nisam.video
 * Handles rate limiting, view buffering, session tracking
 * Now backed by Postgres (Drizzle) instead of Replit DB
 */

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_LIKES_PER_WINDOW = 10; // Max 10 likes per minute per user

// View buffering configuration
const VIEW_BUFFER_THRESHOLD = 5; // Sync to DB after 5 buffered views
const VIEW_BUFFER_TIMEOUT = 30 * 1000; // Or sync every 30 seconds

// Viewing history configuration
const MAX_HISTORY_ITEMS = 20; // Keep last 20 videos per session

const KV_DEBUG = process.env.KV_DEBUG === "1";
const KV_DISABLE_BACKGROUND_TASKS = process.env.KV_DISABLE_BACKGROUND_TASKS === "1";

function kvDebug(message: string, ...args: any[]) {
  if (!KV_DEBUG) return;
  console.log(message, ...args);
}

export const kvService = {
  /**
   * Rate limiting for likes
   * Returns true if action is allowed, false if rate limited
   */
  async checkRateLimit(userIdentifier: string, action: string): Promise<boolean> {
    const key = `ratelimit:${action}:${userIdentifier}`;
    const now = Date.now();
    
    try {
      kvDebug(`[kv] rate limit check: ${key}`);
      const data = await kvStore.get(key);
      kvDebug(`[kv] rate limit data:`, data);
      
      if (!data) {
        // First action, allow and create entry
        kvDebug(`[kv] rate limit init`);
        await kvStore.set(key, {
          count: 1,
          windowStart: now
        });
        return true;
      }
      
      const { count, windowStart } = data;
      const windowAge = now - windowStart;
      
      // Check if window has expired
      if (windowAge > RATE_LIMIT_WINDOW) {
        // Reset window
        kvDebug(`[kv] rate limit reset`);
        await kvStore.set(key, {
          count: 1,
          windowStart: now
        });
        return true;
      }
      
      // Check if limit exceeded
      if (count >= MAX_LIKES_PER_WINDOW) {
        kvDebug(`[kv] rate limit exceeded: ${count} >= ${MAX_LIKES_PER_WINDOW}`);
        return false;
      }
      
      // Increment counter
      kvDebug(`[kv] rate limit increment: ${count + 1}`);
      await kvStore.set(key, {
        count: count + 1,
        windowStart
      });
      return true;
    } catch (error) {
      console.error('[KV] Rate limit check error:', error);
      // On error, allow action (fail open)
      return true;
    }
  },

  /**
   * Buffer view count and periodically sync to database.
   *
   * Uses Redis INCR (atomic, race-free, multi-instance safe) when available.
   * Falls back to the Postgres-backed kvStore when Redis is unavailable —
   * note: the fallback path is not race-safe across instances and should
   * only be relied on for single-instance / local-dev deployments.
   */
  async bufferView(videoId: string, userIdentifier: string): Promise<void> {
    const bufferKey = `viewbuffer:${videoId}`;
    const lastSyncKey = `viewbuffer:lastsync:${videoId}`;

    try {
      const redis = getRedisClient();

      if (redis) {
        // Atomic increment + read in a single round trip.
        const count = await redis.incr(bufferKey);

        // First write seeds the lastSync marker; later reads check elapsed time.
        let shouldSync = count >= VIEW_BUFFER_THRESHOLD;
        if (!shouldSync) {
          const lastSyncRaw = await redis.get(lastSyncKey);
          const lastSync = lastSyncRaw ? Number(lastSyncRaw) : 0;
          if (!lastSync) {
            await redis.set(lastSyncKey, String(Date.now()), "EX", 3600);
          } else if (Date.now() - lastSync >= VIEW_BUFFER_TIMEOUT) {
            shouldSync = true;
          }
        }

        if (shouldSync) {
          // GETSET atomically reads + resets the counter so concurrent flushes
          // don't double-count.
          const flushed = await redis.getset(bufferKey, "0");
          const flushedCount = Number(flushed) || 0;
          if (flushedCount > 0) {
            await this.syncViewBuffer(videoId, flushedCount);
          }
          await redis.set(lastSyncKey, String(Date.now()), "EX", 3600);
        }
      } else {
        // Fallback: Postgres-backed buffer (legacy behavior, racy across instances).
        const buffer = await kvStore.get(bufferKey) || { count: 0, lastSync: Date.now() };
        buffer.count++;
        const now = Date.now();
        const shouldSync =
          buffer.count >= VIEW_BUFFER_THRESHOLD ||
          (now - buffer.lastSync) >= VIEW_BUFFER_TIMEOUT;

        if (shouldSync) {
          await this.syncViewBuffer(videoId, buffer.count);
          await kvStore.set(bufferKey, { count: 0, lastSync: now });
        } else {
          await kvStore.set(bufferKey, buffer);
        }
      }

      // Record viewing history off the hot path.
      this.recordViewInHistory(userIdentifier, videoId).catch(err =>
        console.error('History recording error:', err)
      );
    } catch (error) {
      console.error('View buffering error:', error);
      // Last-resort fallback: write the single view directly.
      await this.syncViewBuffer(videoId, 1).catch(() => {});
    }
  },

  /**
   * Sync buffered views to database
   */
  async syncViewBuffer(videoId: string, count: number): Promise<void> {
    try {
      // Increment views count in database
      await storage.incrementVideoViews(videoId, count);
    } catch (error) {
      console.error(`Failed to sync view buffer for video ${videoId}:`, error);
      throw error;
    }
  },

  /**
   * Record video in user's viewing history
   */
  async recordViewInHistory(userIdentifier: string, videoId: string): Promise<void> {
    const historyKey = `history:${userIdentifier}`;
    
    try {
      const historyData = await kvStore.get(historyKey);
      const history = Array.isArray(historyData) ? historyData : [];
      
      // Remove duplicate if exists
      const filtered = history.filter((id: string) => id !== videoId);
      
      // Add to front
      filtered.unshift(videoId);
      
      // Trim to max size
      const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);
      
      await kvStore.set(historyKey, trimmed);
    } catch (error) {
      console.error('History recording error:', error);
    }
  },

  /**
   * Get user's viewing history
   */
  async getViewingHistory(userIdentifier: string): Promise<string[]> {
    const historyKey = `history:${userIdentifier}`;
    
    try {
      const history = await kvStore.get(historyKey);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('Get history error:', error);
      return [];
    }
  },

  /**
   * Get KV store statistics
   */
  async getStats(): Promise<any> {
    try {
      const allKeysData = await kvStore.list();
      const allKeys = Array.isArray(allKeysData) ? allKeysData : [];
      
      const stats = {
        totalKeys: allKeys.length,
        ratelimitKeys: 0,
        viewBufferKeys: 0,
        historyKeys: 0,
        otherKeys: 0,
        breakdown: {} as Record<string, number>
      };
      
      // Categorize keys
      for (const key of allKeys) {
        if (key.startsWith('ratelimit:')) {
          stats.ratelimitKeys++;
        } else if (key.startsWith('viewbuffer:')) {
          stats.viewBufferKeys++;
        } else if (key.startsWith('history:')) {
          stats.historyKeys++;
        } else {
          stats.otherKeys++;
        }
      }
      
      stats.breakdown = {
        'Rate Limits': stats.ratelimitKeys,
        'View Buffers': stats.viewBufferKeys,
        'Viewing History': stats.historyKeys,
        'Other': stats.otherKeys
      };
      
      return stats;
    } catch (error) {
      console.error('Get stats error:', error);
      return {
        totalKeys: 0,
        error: 'Failed to fetch stats'
      };
    }
  },

  /**
   * Clear expired rate limit entries (cleanup)
   */
  async cleanupRateLimits(): Promise<number> {
    try {
      const rateLimitKeysData = await kvStore.list('ratelimit:');
      const rateLimitKeys = Array.isArray(rateLimitKeysData) ? rateLimitKeysData : [];
      const now = Date.now();
      let cleaned = 0;
      
      for (const key of rateLimitKeys) {
        try {
          const data = await kvStore.get(key);
          if (data && data.windowStart) {
            const age = now - data.windowStart;
            if (age > RATE_LIMIT_WINDOW) {
              await kvStore.delete(key);
              cleaned++;
            }
          }
        } catch {
        }
      }
      
      return cleaned;
    } catch (error) {
      console.error('Cleanup error:', error);
      return 0;
    }
  },

  /**
   * Flush all view buffers to database
   */
  async flushAllViewBuffers(): Promise<number> {
    try {
      const bufferKeysData = await kvStore.list('viewbuffer:');
      const bufferKeys = Array.isArray(bufferKeysData) ? bufferKeysData : [];
      let flushed = 0;
      
      for (const key of bufferKeys) {
        try {
          const videoId = key.replace('viewbuffer:', '');
          const buffer = await kvStore.get(key);
          
          if (buffer && buffer.count > 0) {
            await this.syncViewBuffer(videoId, buffer.count);
            await kvStore.set(key, { count: 0, lastSync: Date.now() });
            flushed++;
          }
        } catch {
        }
      }
      
      return flushed;
    } catch (error) {
      console.error('Flush buffers error:', error);
      return 0;
    }
  }
};

// Background task to periodically flush view buffers and clean up rate limits
setInterval(async () => {
  if (KV_DISABLE_BACKGROUND_TASKS) return;
  try {
    const [flushed, cleaned] = await Promise.all([
      kvService.flushAllViewBuffers(),
      kvService.cleanupRateLimits()
    ]);
    
    if (flushed > 0 || cleaned > 0) {
      console.log(`KV cleanup: Flushed ${flushed} view buffers, cleaned ${cleaned} rate limits`);
    }
  } catch (error) {
    console.error('Background KV cleanup error:', error);
  }
}, 60 * 1000); // Run every minute
