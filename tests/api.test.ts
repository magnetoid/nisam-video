import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import express from "express";

const mockStorage = vi.hoisted(() => ({
  getRandomHeroImages: vi.fn().mockResolvedValue(null),
  getAllVideos: vi.fn().mockResolvedValue([]),
  getHomeHeroVideos: vi.fn().mockResolvedValue([]),
  getRecentVideos: vi.fn().mockResolvedValue([]),
  getTrendingVideos: vi.fn().mockResolvedValue([]),
  getAllLocalizedCategories: vi.fn().mockResolvedValue([]),
  getVideosByCategory: vi.fn().mockResolvedValue([]),
  getSeoSettings: vi.fn().mockResolvedValue({}),
  getSystemSettings: vi.fn().mockResolvedValue({ cacheEnabled: false }),
  getSchedulerSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("../server/storage/index.js", () => ({
  storage: mockStorage,
}));

vi.mock("../server/storage.js", () => ({
  storage: mockStorage,
}));

vi.mock("../server/scheduler.js", () => ({
  scheduler: { init: vi.fn() },
}));

vi.mock("../server/cache-middleware.js", () => ({
  cacheMiddleware: () => (_req: any, _res: any, next: any) => next(),
  invalidateCacheOnMutation: () => (_req: any, _res: any, next: any) => next(),
}));

import { registerRoutes } from "../server/routes.js";

describe('API Endpoints', () => {
  const app = express();

  beforeAll(async () => {
    app.use(express.json());
    await registerRoutes(app);
  });

  it('GET /api/videos should return 200 and empty array', async () => {
    const res = await request(app).get('/api/videos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/videos/carousels should return 200', async () => {
    const res = await request(app).get('/api/videos/carousels');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hero');
    expect(Array.isArray(res.body.hero)).toBe(true);
    expect(res.body).toHaveProperty('recent');
  });

  it('GET /api/hero/random should return 200 and stable payload', async () => {
    const res = await request(app).get('/api/hero/random');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('images');
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(res.body).toHaveProperty('settings');
    expect(res.body.settings).toHaveProperty('animationType');
  });

  it('GET /api/hero/random-video should return 200', async () => {
    const res = await request(app).get('/api/hero/random-video');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('video');
    expect(res.body).toHaveProperty('embedUrl');
  });

  it('GET /api/public/error-logs should 404 without token', async () => {
    const res = await request(app).get('/api/public/error-logs');
    expect(res.status).toBe(404);
  });

  it('GET /api/public/error-logs should return JSON with valid token', async () => {
    const prev = process.env.PUBLIC_ERROR_LOGS_TOKEN;
    process.env.PUBLIC_ERROR_LOGS_TOKEN = 'test-token';
    const res = await request(app).get('/api/public/error-logs?token=test-token');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    process.env.PUBLIC_ERROR_LOGS_TOKEN = prev;
  });
});
