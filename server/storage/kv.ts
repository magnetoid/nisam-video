import { db } from "../db.js";
import { kvStore } from "../../shared/schema.js";
import { eq, like, and, lt, sql } from "drizzle-orm";
import pRetry from "p-retry";

let lastKvErrorLogAt = 0;
let suppressedKvErrorCount = 0;

function logKvError(op: string, error: unknown) {
  const message =
    error && typeof (error as any).message === "string"
      ? (error as any).message
      : String(error);

  const now = Date.now();
  const throttleMs = 5 * 60 * 1000;
  if (now - lastKvErrorLogAt < throttleMs) {
    suppressedKvErrorCount++;
    return;
  }

  const suffix =
    suppressedKvErrorCount > 0
      ? ` (suppressed ${suppressedKvErrorCount} similar errors)`
      : "";
  suppressedKvErrorCount = 0;
  lastKvErrorLogAt = now;

  console.error(`[kv] ${op} failed: ${message}${suffix}`);
}

// Re-implement the kvStore interface using Drizzle
export const kvStorage = {
  // Store a value
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const expiresAt = ttlSeconds 
        ? new Date(Date.now() + ttlSeconds * 1000) 
        : null;

      await db.insert(kvStore)
        .values({
          key,
          value,
          expiresAt
        })
        .onConflictDoUpdate({
          target: kvStore.key,
          set: {
            value,
            expiresAt
          }
        });
    } catch (error) {
      logKvError(`set (${key})`, error);
      throw error;
    }
  },

  // Get a value - returns null if not found or expired
  async get(key: string): Promise<any> {
    try {
      // First clean up if expired (lazy cleanup on access)
      // Or just filter in the query. Let's filter in query for speed.
      const result = await db.select()
        .from(kvStore)
        .where(
          and(
            eq(kvStore.key, key),
            // Check expiry: expiresAt IS NULL OR expiresAt > NOW()
            sql`(${kvStore.expiresAt} IS NULL OR ${kvStore.expiresAt} > NOW())`
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0].value;
    } catch (error) {
      logKvError(`get (${key})`, error);
      return null;
    }
  },

  // Delete a value
  async delete(key: string): Promise<void> {
    try {
      await db.delete(kvStore).where(eq(kvStore.key, key));
    } catch (error) {
      logKvError(`delete (${key})`, error);
      throw error;
    }
  },

  // List all keys (optionally with a prefix filter)
  async list(prefix?: string): Promise<string[]> {
    try {
      let query = db
        .select({ key: kvStore.key })
        .from(kvStore)
        .where(sql`(${kvStore.expiresAt} IS NULL OR ${kvStore.expiresAt} > NOW())`);
      
      if (prefix) {
        query = query.where(
          and(
            like(kvStore.key, `${prefix}%`),
            sql`(${kvStore.expiresAt} IS NULL OR ${kvStore.expiresAt} > NOW())`,
          ),
        );
      }

      // Filter expired
      // Note: This might be slow for large tables without an index on expiresAt
      // But for this use case (rate limits, buffers) it's acceptable
      
      const rows = await pRetry(
        async () => {
          return await query;
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 200,
          maxTimeout: 2000,
        },
      ).catch(() => null);
      if (!rows) return [];
      return rows.map((r: { key: string }) => r.key);
    } catch (error) {
      logKvError(prefix ? `list (${prefix})` : "list", error);
      return [];
    }
  },

  // Get all key-value pairs (optionally with a prefix filter)
  async getAll(prefix?: string): Promise<Record<string, any>> {
    try {
      const keys = await this.list(prefix);
      const result: Record<string, any> = {};
      
      for (const key of keys) {
        result[key] = await this.get(key);
      }
      
      return result;
    } catch (error) {
      logKvError(prefix ? `getAll (${prefix})` : "getAll", error);
      return {};
    }
  },

  // Clear all keys (optionally with a prefix filter)
  async clear(prefix?: string): Promise<void> {
    try {
      if (prefix) {
        await db.delete(kvStore).where(like(kvStore.key, `${prefix}%`));
      } else {
        await db.delete(kvStore);
      }
    } catch (error) {
      logKvError(prefix ? `clear (${prefix})` : "clear", error);
      throw error;
    }
  },
  
  // Cleanup expired keys (maintenance task)
  async cleanupExpired(): Promise<number> {
    try {
      const result = await db.delete(kvStore)
        .where(lt(kvStore.expiresAt, new Date()))
        .returning({ key: kvStore.key });
        
      return result.length;
    } catch (error) {
      logKvError("cleanupExpired", error);
      return 0;
    }
  }
};
