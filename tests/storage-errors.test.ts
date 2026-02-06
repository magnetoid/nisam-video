import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabaseStorage } from '../server/storage/database.js';
import { cache } from '../server/cache.js';

// Mock the database and cache
vi.mock('../server/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])),
              })),
            })),
          })),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
    })),
  },
  isDbReady: vi.fn(() => true),
}));

vi.mock('../server/cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}));

describe('DatabaseStorage - Error Handling', () => {
  let storage: DatabaseStorage;

  beforeAll(() => {
    storage = new DatabaseStorage();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache by default
    (cache.get as any).mockReturnValue(undefined);
  });

  describe('getTrendingVideos', () => {
    it('should handle SQL errors gracefully and fallback to simple query', async () => {
      const { db } = await import('../server/db.js');
      
      // Mock the first query to fail with SQL error
      const mockAdvancedQuery = vi.fn(() => Promise.reject(new Error('REGEXP_REPLACE not supported')));
      const mockSimpleQuery = vi.fn(() => Promise.resolve([
        { id: 'video1', title: 'Test Video', publishDate: new Date() }
      ]));

      // First call fails, second succeeds
      db.select = vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: mockAdvancedQuery,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: mockSimpleQuery,
              }),
            }),
          }),
        });

      // Mock hydrateVideosWithRelations to return empty array
      vi.spyOn(storage as any, 'hydrateVideosWithRelations').mockResolvedValue([]);

      const result = await storage.getTrendingVideos(10, 'en');

      expect(result).toEqual([]);
      expect(mockAdvancedQuery).toHaveBeenCalled();
      expect(mockSimpleQuery).toHaveBeenCalled();
    });

    it('should return empty array on complete failure', async () => {
      const { db } = await import('../server/db.js');
      
      // Mock both queries to fail
      db.select = vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.reject(new Error('Database connection failed')),
            }),
          }),
        }),
      }));

      const result = await storage.getTrendingVideos(10, 'en');

      expect(result).toEqual([]);
    });
  });

  describe('getVideosByCategory', () => {
    it('should handle invalid parameters', async () => {
      const result1 = await storage.getVideosByCategory('', 10, 'en');
      const result2 = await storage.getVideosByCategory('valid-id', 0, 'en');
      const result3 = await storage.getVideosByCategory('valid-id', -5, 'en');

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result3).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      const { db } = await import('../server/db.js');
      
      // Mock database error
      db.select = vi.fn(() => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.reject(new Error('Database query failed')),
              }),
            }),
          }),
        }),
      }));

      const result = await storage.getVideosByCategory('valid-id', 10, 'en');

      expect(result).toEqual([]);
    });
  });

  describe('getHeroVideo', () => {
    it('should handle database errors gracefully', async () => {
      const { db } = await import('../server/db.js');
      
      // Mock database error
      db.select = vi.fn(() => ({
        from: () => ({
          orderBy: () => ({
            limit: () => Promise.reject(new Error('Database connection lost')),
          }),
        }),
      }));

      const result = await storage.getHeroVideo('en');

      expect(result).toBeNull();
    });

    it('should handle empty results', async () => {
      const { db } = await import('../server/db.js');
      
      // Mock empty result
      db.select = vi.fn(() => ({
        from: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }));

      const result = await storage.getHeroVideo('en');

      expect(result).toBeNull();
    });
  });

  describe('getCacheSettings', () => {
    it('should return defaults when database is not ready', async () => {
      const { isDbReady } = await import('../server/db.js');
      (isDbReady as any).mockReturnValue(false);

      // Mock getSystemSettings to throw error
      vi.spyOn(storage as any, 'getSystemSettings').mockRejectedValue(new Error('Database not available'));

      const result = await (storage as any).getCacheSettings();

      expect(result).toEqual({
        enabled: true,
        videosTTL: 300000,
        channelsTTL: 600000,
        categoriesTTL: 600000,
        apiTTL: 180000,
      });
    });

    it('should handle getSystemSettings errors gracefully', async () => {
      const { isDbReady } = await import('../server/db.js');
      (isDbReady as any).mockReturnValue(true);

      // Mock getSystemSettings to throw error
      vi.spyOn(storage as any, 'getSystemSettings').mockRejectedValue(new Error('Settings table not found'));

      const result = await (storage as any).getCacheSettings();

      expect(result).toEqual({
        enabled: true,
        videosTTL: 300000,
        channelsTTL: 600000,
        categoriesTTL: 600000,
        apiTTL: 180000,
      });
    });
  });
});