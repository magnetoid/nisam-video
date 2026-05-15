import Redis from "ioredis";
import pRetry from "p-retry";
import { recordError } from "../error-log-service.js";

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

  const normalizedUrl = redisUrl.startsWith("//") ? `redis:${redisUrl}` : redisUrl;

  let isTls = false;
  try {
    const parsed = new URL(normalizedUrl);
    isTls = parsed.protocol === "rediss:";
  } catch {
    isTls = normalizedUrl.startsWith("rediss://");
  }

  try {
    console.log("[Redis] Connecting to Redis...");
    redisClient = new Redis(normalizedUrl, {
      maxRetriesPerRequest: 1, // Fail fast for individual requests
      enableOfflineQueue: false, // Don't queue commands if disconnected
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
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

export async function connectToRedis(url: string): Promise<boolean> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (e) {
      // Ignore close errors
    }
    redisClient = null;
  }
  
  process.env.REDIS_URL = url;
  const client = getRedisClient();
  
  if (!client) return false;

  // Wait a bit to see if connection is successful
  return new Promise((resolve) => {
    // Check if ready or wait for connect
    if (client.status === 'ready' || client.status === 'connect') {
      resolve(true);
    } else {
      const onConnect = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      
      const cleanup = () => {
        client.off('connect', onConnect);
        client.off('error', onError);
      };

      client.once('connect', onConnect);
      client.once('error', onError);
      
      // Timeout
      setTimeout(() => {
        cleanup();
        resolve(client.status === 'ready');
      }, 5000);
    }
  });
}

// Helper functions for cache
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await pRetry(
      async () => {
        if (redis.status !== "ready") {
          throw new Error(`Redis not ready (status=${redis.status})`);
        }
        return await redis.get(key);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 1500,
        onFailedAttempt: () => {},
      },
    ).catch(() => null);
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
    await pRetry(
      async () => {
        if (redis.status !== "ready") {
          throw new Error(`Redis not ready (status=${redis.status})`);
        }
        await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 100,
        maxTimeout: 1500,
        onFailedAttempt: () => {},
      },
    ).catch((error) => {
      recordError({ level: "error", type: "redis_error", message: "Failed to set cache", context: { service: "Redis", method: "setCache", key, error: String(error) } });
    });
  } catch (error) {
    recordError({ level: "error", type: "redis_error", message: "Failed to set cache", context: { service: "Redis", method: "setCache", key, error: String(error) } });
  }
}

export async function clearCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    if (redis.status !== "ready") {
      throw new Error(`Redis not ready (status=${redis.status})`);
    }

    // Use SCAN to avoid blocking Redis on large keyspaces
    let cursor = "0";
    const keysToDelete: string[] = [];
    
    do {
      const result = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        keysToDelete.push(...keys);
      }
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      // Delete in batches of 500 to avoid large payload limits
      for (let i = 0; i < keysToDelete.length; i += 500) {
        const batch = keysToDelete.slice(i, i + 500);
        await redis.del(batch);
      }
    }
  } catch (error) {
    console.error(`[Redis] Clear error for pattern ${pattern}:`, error);
  }
}
