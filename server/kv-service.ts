import { kvStore } from './replit-db.js';
import { storage } from './storage.js';

/**
 * KV Store Service for nisam.video
 * Handles rate limiting, view buffering, session tracking
 */

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_LIKES_PER_WINDOW = 10; // Max 10 likes per minute per user

// View buffering configuration
const VIEW_BUFFER_THRESHOLD = 5; // Sync to DB after 5 buffered views
const VIEW_BUFFER_TIMEOUT = 30 * 1000; // Or sync every 30 seconds

// Viewing history configuration
const MAX_HISTORY_ITEMS = 20; // Keep last 20 videos per session

export const kvService = {
  /**
   * Rate limiting for likes
   * Returns true if action is allowed, false if rate limited
   */
  async checkRateLimit(userIdentifier: string, action: string): Promise<boolean> {
    const key = `ratelimit:${action}:${userIdentifier}`;
    const now = Date.now();
    
    try {
      console.log(`[KV] Checking rate limit for key: ${key}`);
      const data = await kvStore.get(key);
      console.log(`[KV] Rate limit data retrieved:`, data);
      
      if (!data) {
        // First action, allow and create entry
        console.log(`[KV] First action, setting rate limit`);
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
        console.log(`[KV] Window expired, resetting`);
        await kvStore.set(key, {
          count: 1,
          windowStart: now
        });
        return true;
      }
      
      // Check if limit exceeded
      if (count >= MAX_LIKES_PER_WINDOW) {
        console.log(`[KV] Rate limit exceeded: ${count} >= ${MAX_LIKES_PER_WINDOW}`);
        return false;
      }
      
      // Increment counter
      console.log(`[KV] Incrementing counter to ${count + 1}`);
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
   * Buffer view count and periodically sync to database
   */
  async bufferView(videoId: string, userIdentifier: string): Promise<void> {
    const bufferKey = `viewbuffer:${videoId}`;
    
    try {
      // Get current buffer
      const buffer = await kvStore.get(bufferKey) || { count: 0, lastSync: Date.now() };
      
      // Increment buffer
      buffer.count++;
      const now = Date.now();
      
      // Check if we should sync
      const shouldSync = buffer.count >= VIEW_BUFFER_THRESHOLD || 
                         (now - buffer.lastSync) >= VIEW_BUFFER_TIMEOUT;
      
      if (shouldSync) {
        // Sync to database
        await this.syncViewBuffer(videoId, buffer.count);
        
        // Reset buffer
        await kvStore.set(bufferKey, { count: 0, lastSync: now });
      } else {
        // Update buffer
        await kvStore.set(bufferKey, buffer);
      }
      
      // Also record individual view for history (non-blocking)
      this.recordViewInHistory(userIdentifier, videoId).catch(err => 
        console.error('History recording error:', err)
      );
    } catch (error) {
      console.error('View buffering error:', error);
      // Fall back to direct DB write
      await this.syncViewBuffer(videoId, 1);
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
        const data = await kvStore.get(key);
        if (data && data.windowStart) {
          const age = now - data.windowStart;
          if (age > RATE_LIMIT_WINDOW) {
            await kvStore.delete(key);
            cleaned++;
          }
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
        const videoId = key.replace('viewbuffer:', '');
        const buffer = await kvStore.get(key);
        
        if (buffer && buffer.count > 0) {
          await this.syncViewBuffer(videoId, buffer.count);
          await kvStore.set(key, { count: 0, lastSync: Date.now() });
          flushed++;
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
