import Database from '@replit/database';

// Initialize Replit Key-Value Store or Fallback
let replitDb: any;

class InMemoryDB {
  private store = new Map<string, any>();

  async set(key: string, value: any) {
    this.store.set(key, value);
    return { ok: true };
  }

  async get(key: string) {
    const value = this.store.get(key);
    if (value === undefined) {
      return { ok: false, error: { statusCode: 404 } };
    }
    return { ok: true, value };
  }

  async delete(key: string) {
    this.store.delete(key);
    return { ok: true };
  }

  async list(prefix?: string) {
    let keys = Array.from(this.store.keys());
    if (prefix) {
      keys = keys.filter(k => k.startsWith(prefix));
    }
    return { ok: true, value: keys };
  }
}

try {
  if (process.env.REPLIT_DB_URL) {
    replitDb = new Database();
  } else {
    console.warn("REPLIT_DB_URL not set. Using in-memory fallback for KV store.");
    replitDb = new InMemoryDB();
  }
} catch (error) {
  console.warn("Failed to initialize Replit Database. Using in-memory fallback.", error);
  replitDb = new InMemoryDB();
}

// Helper functions for common operations
export const kvStore = {
  // Store a value
  async set(key: string, value: any): Promise<void> {
    const result: any = await replitDb.set(key, value);
    if (result && !result.ok) {
      throw new Error(`KV set failed: ${result.error?.message || 'Unknown error'}`);
    }
  },

  // Get a value - returns null if not found
  async get(key: string): Promise<any> {
    const result: any = await replitDb.get(key);
    
    // Handle Result type: { ok: true, value: ... } or { ok: false, error: ... }
    if (result && typeof result === 'object' && 'ok' in result) {
      if (result.ok) {
        return result.value;
      } else {
        // 404 means key not found, return null
        if (result.error?.statusCode === 404) {
          return null;
        }
        // Other errors should be logged
        console.error('KV get error:', result.error);
        return null;
      }
    }
    
    // Fallback for unexpected format
    return result;
  },

  // Delete a value
  async delete(key: string): Promise<void> {
    const result: any = await replitDb.delete(key);
    if (result && !result.ok && result.error?.statusCode !== 404) {
      throw new Error(`KV delete failed: ${result.error?.message || 'Unknown error'}`);
    }
  },

  // List all keys (optionally with a prefix filter)
  async list(prefix?: string): Promise<string[]> {
    const result: any = await replitDb.list(prefix);
    
    // Handle Result type
    if (result && typeof result === 'object' && 'ok' in result) {
      if (result.ok) {
        return Array.isArray(result.value) ? result.value : [];
      } else {
        console.error('KV list error:', result.error);
        return [];
      }
    }
    
    // Fallback: try to convert to array
    return Array.isArray(result) ? result : [];
  },

  // Get all key-value pairs (optionally with a prefix filter)
  async getAll(prefix?: string): Promise<Record<string, any>> {
    const keys = await this.list(prefix);
    const result: Record<string, any> = {};
    
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    
    return result;
  },

  // Clear all keys (optionally with a prefix filter)
  async clear(prefix?: string): Promise<void> {
    const keys = await this.list(prefix);
    for (const key of keys) {
      await this.delete(key);
    }
  }
};
