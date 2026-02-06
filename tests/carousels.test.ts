import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from 'supertest';
import type { Express } from 'express';

const mockStorage = vi.hoisted(() => ({
  getHomeHeroVideos: vi.fn(),
  getRecentVideos: vi.fn(),
  getTrendingVideos: vi.fn(),
  getAllLocalizedCategories: vi.fn(),
  getVideosByCategory: vi.fn(),
}));

// Mock the storage module
vi.mock("../server/storage/index.js", () => ({ storage: mockStorage }));
vi.mock("../server/storage.js", () => ({ storage: mockStorage }));

// Import after mocking
import { registerRoutes } from '../server/routes.js';
import express from 'express';

describe('Carousels API Endpoint', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/videos/carousels', () => {
    it('should return carousels data successfully', async () => {
      // Mock successful responses
      mockStorage.getHomeHeroVideos.mockResolvedValue([{ id: 'hero1', title: 'Hero Video' }]);
      mockStorage.getRecentVideos.mockResolvedValue([
        { id: 'recent1', title: 'Recent Video 1' },
        { id: 'recent2', title: 'Recent Video 2' },
      ]);
      mockStorage.getTrendingVideos.mockResolvedValue([
        { id: 'trending1', title: 'Trending Video 1' },
      ]);
      mockStorage.getAllLocalizedCategories.mockResolvedValue([
        { id: 'cat1', translations: [{ name: 'News' }] },
        { id: 'cat2', translations: [{ name: 'Entertainment' }] },
      ]);
      mockStorage.getVideosByCategory.mockResolvedValue([
        { id: 'catVideo1', title: 'Category Video 1' },
      ]);

      const response = await request(app)
        .get('/api/videos/carousels?lang=en&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('hero');
      expect(response.body).toHaveProperty('recent');
      expect(response.body).toHaveProperty('trending');
      expect(response.body).toHaveProperty('byCategory');
      expect(response.body.hero).toEqual([{ id: 'hero1', title: 'Hero Video' }]);
      expect(response.body.recent).toHaveLength(2);
      expect(response.body.trending).toHaveLength(1);
    });

    it('should handle hero video failure gracefully', async () => {
      mockStorage.getHomeHeroVideos.mockRejectedValue(new Error('Hero video error'));
      mockStorage.getRecentVideos.mockResolvedValue([]);
      mockStorage.getTrendingVideos.mockResolvedValue([]);
      mockStorage.getAllLocalizedCategories.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/videos/carousels?lang=en')
        .expect(200);

      expect(response.body.hero).toEqual([]);
      expect(response.body.recent).toEqual([]);
      expect(response.body.trending).toEqual([]);
      expect(response.body.byCategory).toEqual({});
    });

    it('should handle trending videos failure gracefully', async () => {
      mockStorage.getHomeHeroVideos.mockResolvedValue([]);
      mockStorage.getRecentVideos.mockResolvedValue([]);
      mockStorage.getTrendingVideos.mockRejectedValue(new Error('Trending videos error'));
      mockStorage.getAllLocalizedCategories.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/videos/carousels?lang=en')
        .expect(200);

      expect(response.body.hero).toEqual([]);
      expect(response.body.recent).toEqual([]);
      expect(response.body.trending).toEqual([]);
      expect(response.body.byCategory).toEqual({});
    });

    it('should handle categories failure gracefully', async () => {
      mockStorage.getHomeHeroVideos.mockResolvedValue([]);
      mockStorage.getRecentVideos.mockResolvedValue([]);
      mockStorage.getTrendingVideos.mockResolvedValue([]);
      mockStorage.getAllLocalizedCategories.mockRejectedValue(new Error('Categories error'));

      const response = await request(app)
        .get('/api/videos/carousels?lang=en')
        .expect(200);

      expect(response.body.hero).toEqual([]);
      expect(response.body.recent).toEqual([]);
      expect(response.body.trending).toEqual([]);
      expect(response.body.byCategory).toEqual({});
    });

    it('should handle individual category video failures gracefully', async () => {
      mockStorage.getHomeHeroVideos.mockResolvedValue([]);
      mockStorage.getRecentVideos.mockResolvedValue([]);
      mockStorage.getTrendingVideos.mockResolvedValue([]);
      mockStorage.getAllLocalizedCategories.mockResolvedValue([
        { id: 'cat1', translations: [{ name: 'News' }] },
        { id: 'cat2', translations: [{ name: 'Entertainment' }] },
      ]);
      // First category succeeds, second fails
      mockStorage.getVideosByCategory
        .mockResolvedValueOnce([{ id: 'cat1Video', title: 'Category 1 Video' }])
        .mockRejectedValueOnce(new Error('Category 2 error'));

      const response = await request(app)
        .get('/api/videos/carousels?lang=en')
        .expect(200);

      expect(response.body.byCategory).toHaveProperty('News');
      expect(response.body.byCategory).not.toHaveProperty('Entertainment');
      expect(response.body.byCategory.News).toHaveLength(1);
    });

    it('should handle multiple simultaneous failures', async () => {
      mockStorage.getHomeHeroVideos.mockRejectedValue(new Error('Hero error'));
      mockStorage.getRecentVideos.mockRejectedValue(new Error('Recent error'));
      mockStorage.getTrendingVideos.mockRejectedValue(new Error('Trending error'));
      mockStorage.getAllLocalizedCategories.mockRejectedValue(new Error('Categories error'));

      const response = await request(app)
        .get('/api/videos/carousels?lang=en')
        .expect(200);

      // Should return empty data instead of 500 error
      expect(response.body).toEqual({
        hero: [],
        recent: [],
        trending: [],
        byCategory: {},
      });
    });

    it('should use default parameters when not provided', async () => {
      mockStorage.getHomeHeroVideos.mockResolvedValue([]);
      mockStorage.getRecentVideos.mockResolvedValue([]);
      mockStorage.getTrendingVideos.mockResolvedValue([]);
      mockStorage.getAllLocalizedCategories.mockResolvedValue([]);

      await request(app)
        .get('/api/videos/carousels')
        .expect(200);

      // Should call with default lang='en' and limit=10
      expect(mockStorage.getHomeHeroVideos).toHaveBeenCalledWith(4, 'en');
      expect(mockStorage.getRecentVideos).toHaveBeenCalledWith(10, 'en');
      expect(mockStorage.getTrendingVideos).toHaveBeenCalledWith(10, 'en');
      expect(mockStorage.getAllLocalizedCategories).toHaveBeenCalledWith('en');
    });

    it('should handle invalid limit parameter', async () => {
      mockStorage.getHomeHeroVideos.mockResolvedValue([]);
      mockStorage.getRecentVideos.mockResolvedValue([]);
      mockStorage.getTrendingVideos.mockResolvedValue([]);
      mockStorage.getAllLocalizedCategories.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/videos/carousels?limit=invalid')
        .expect(200);

      // Should use default limit of 10
      expect(mockStorage.getRecentVideos).toHaveBeenCalledWith(10, 'en');
      expect(mockStorage.getTrendingVideos).toHaveBeenCalledWith(10, 'en');
    });
  });
});
