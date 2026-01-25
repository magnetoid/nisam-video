interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

interface CacheStats {
  totalKeys: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  maxEntries: number;
  evictions: number;
}

class Cache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default
  private maxEntries = 500; // LRU cap
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setMaxEntries(max: number): void {
    this.maxEntries = max;
    this.evictIfNeeded();
  }

  getMaxEntries(): number {
    return this.maxEntries;
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxEntries) {
      // Find and remove least recently accessed entry
      let oldestKey: string | null = null;
      let oldestAccess = Infinity;
      
      for (const [key, entry] of Array.from(this.cache.entries())) {
        if (entry.lastAccessed < oldestAccess) {
          oldestAccess = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      } else {
        break;
      }
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.enabled) return;

    // Evict old entries if at capacity
    if (!this.cache.has(key)) {
      this.evictIfNeeded();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttl || this.defaultTTL,
      hits: 0,
      lastAccessed: now,
    });
  }

  get<T>(key: string): T | null {
    if (!this.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update LRU access time
    entry.lastAccessed = now;
    entry.hits++;
    this.stats.hits++;
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const timestamps = entries.map((e) => e.timestamp);

    // Estimate memory usage (rough approximation)
    const memoryUsage = JSON.stringify(Array.from(this.cache.entries())).length;

    return {
      totalKeys: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate:
        this.stats.hits + this.stats.misses > 0
          ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
          : 0,
      memoryUsage,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
      maxEntries: this.maxEntries,
      evictions: this.stats.evictions,
    };
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    const keys = Array.from(this.cache.keys());
    let cleaned = 0;

    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return;
  }
}

export const cache = new Cache();

// Run cleanup every minute
setInterval(() => cache.cleanup(), 60 * 1000);
