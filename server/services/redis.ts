import Redis from "ioredis";

// Globalna instanca
let redisClient: Redis | null = null;

function isRedisUsable(client: Redis): boolean {
  const status = (client as any).status as string | undefined;
  if (!status) return true;
  return status !== "end" && status !== "close";
}

function disableRedisClient(reason?: unknown) {
  if (reason) {
    console.warn("[Redis] Disabling Redis client:", reason);
  }
  try {
    redisClient?.disconnect();
  } catch {
  }
  redisClient = null;
}

async function waitForRedisReady(client: Redis, timeoutMs = 250): Promise<boolean> {
  const status = (client as any).status as string | undefined;
  if (!status || status === "ready") return true;
  if (status === "end" || status === "close") return false;

  return await new Promise<boolean>((resolve) => {
    const c: any = client;

    const onReady = () => finish(true);
    const onError = () => finish(false);
    const onEnd = () => finish(false);

    const remove = (event: string, handler: (...args: any[]) => void) => {
      if (typeof c.off === "function") c.off(event, handler);
      else if (typeof c.removeListener === "function") c.removeListener(event, handler);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    let done = false;
    function finish(ok: boolean) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      remove("ready", onReady);
      remove("error", onError);
      remove("end", onEnd);
      remove("close", onEnd);
      resolve(ok);
    }

    c.once("ready", onReady);
    c.once("error", onError);
    c.once("end", onEnd);
    c.once("close", onEnd);

    if ((client as any).status === "ready") finish(true);
  });
}

export function getRedisClient(): Redis | null {
  if (redisClient) {
    if (!isRedisUsable(redisClient)) {
      disableRedisClient("redis status is not usable");
      return null;
    }
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[Redis] REDIS_URL not found, skipping Redis connection.");
    return null;
  }

  try {
    console.log("[Redis] Connecting to Redis...");
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) {
          console.error("[Redis] Failed to connect after 3 attempts.");
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
    });

    redisClient.on("connect", () => console.log("[Redis] Connected successfully!"));
    redisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
      const msg = (err as any)?.message as string | undefined;
      const code = (err as any)?.code as string | undefined;
      if (
        msg?.includes?.("Connection is closed") ||
        msg?.includes?.("Stream isn't writeable") ||
        code === "ETIMEDOUT"
      ) {
        disableRedisClient(err);
      }
    });

    if (!isRedisUsable(redisClient)) {
      disableRedisClient("redis status is not usable");
      return null;
    }

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
  if (!(await waitForRedisReady(redis))) return null;

  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[Redis] Get error for key ${key}:`, error);
    const msg = (error as any)?.message as string | undefined;
    if (msg?.includes?.("Connection is closed") || msg?.includes?.("Stream isn't writeable")) {
      disableRedisClient(error);
    }
    return null;
  }
}

export async function setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  if (!(await waitForRedisReady(redis))) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.error(`[Redis] Set error for key ${key}:`, error);
    const msg = (error as any)?.message as string | undefined;
    if (msg?.includes?.("Connection is closed") || msg?.includes?.("Stream isn't writeable")) {
      disableRedisClient(error);
    }
  }
}

export async function clearCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  if (!(await waitForRedisReady(redis))) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    console.error(`[Redis] Clear error for pattern ${pattern}:`, error);
    const msg = (error as any)?.message as string | undefined;
    if (msg?.includes?.("Connection is closed") || msg?.includes?.("Stream isn't writeable")) {
      disableRedisClient(error);
    }
  }
}
