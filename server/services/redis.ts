import Redis from "ioredis";

// Global instance
let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    // Only log once to avoid spamming
    if (!global.hasLoggedRedisWarning) {
      console.log("[Redis] REDIS_URL not found, skipping Redis connection.");
      global.hasLoggedRedisWarning = true;
    }
    return null;
  }

  try {
    console.log("[Redis] Connecting to Redis...");
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1, // Fail fast for individual requests
      enableOfflineQueue: false, // Don't queue commands if disconnected
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay; // Keep retrying indefinitely with backoff
      },
      reconnectOnError(err) {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          // Only reconnect when the error starts with "READONLY"
          return true;
        }
        return false;
      },
    });

    redisClient.on("connect", () => console.log("[Redis] Connected successfully!"));
    redisClient.on("error", (err) => {
      // Suppress connection refused logs to avoid spam if Redis is down
      if ((err as any).code === 'ECONNREFUSED') {
         // silent
      } else {
        console.error("[Redis] Connection error:", err.message);
      }
    });

    return redisClient;
  } catch (error) {
    console.error("[Redis] Initialization failed:", error);
    return null;
  }
}

// Add global type for the warning flag
declare global {
  var hasLoggedRedisWarning: boolean | undefined;
}

// Helper functions for cache
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get(key);
    if (!data) return null;
    
    // Attempt to parse JSON
    try {
      return JSON.parse(data);
    } catch {
      // If it's not valid JSON, return as is (useful for raw strings if stored differently)
      // But our setCache uses JSON.stringify, so it SHOULD be valid JSON.
      // If it fails, maybe it was stored raw?
      return data as unknown as T;
    }
  } catch (error) {
    // Redis error
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    // Ignore set errors
  }
}

export async function clearCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    console.error(`[Redis] Clear error for pattern ${pattern}:`, error);
  }
}
