import Redis from "ioredis";

// Globalna instanca
let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[Redis] REDIS_URL not found, skipping Redis connection.");
    return null;
  }

  try {
    console.log("[Redis] Connecting to Redis...");
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.error("[Redis] Failed to connect after 3 attempts.");
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
    });

    redisClient.on("connect", () => console.log("[Redis] Connected successfully!"));
    redisClient.on("error", (err) => console.error("[Redis] Connection error:", err));

    return redisClient;
  } catch (error) {
    console.error("[Redis] Initialization failed:", error);
    return null;
  }
}

// Helper funkcije za cache
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[Redis] Get error for key ${key}:`, error);
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.error(`[Redis] Set error for key ${key}:`, error);
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
