import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage PRE importa routera
const { mockStorage } = vi.hoisted(() => {
  return {
    mockStorage: {
      getAllVideos: vi.fn(),
      getAllChannels: vi.fn(),
      getAllLocalizedCategories: vi.fn(),
      getAllLocalizedTags: vi.fn(),
      getSeoSettings: vi.fn(),
    },
  };
});

vi.mock("../server/storage/index.js", () => ({
  storage: mockStorage,
}));

// Mock db
vi.mock("../server/db.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
  isDbReady: vi.fn().mockReturnValue(true),
  dbUrl: "postgres://mock:5432/mock",
}));

// Mock auth middleware
vi.mock("../server/middleware/auth.js", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

// Import router POSLE mockova
import seoRouter from "../server/routes/seo";

const app = express();
app.use("/api/seo", seoRouter);

describe("Sitemap Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate valid XML sitemap", async () => {
    // Mock data
    const mockVideos = [
      {
        id: "1",
        title: "Test Video & More",
        description: "Test Description <script>",
        videoId: "abc12345",
        thumbnailUrl: "http://example.com/thumb.jpg",
        slug: "test-video",
        createdAt: new Date("2023-01-01"),
      },
    ];

    const mockCategories = [
      { id: "cat1", name: "Category 1" },
    ];

    const mockTags = [
      { id: "tag1", tagName: "tag-1", slug: "tag-1" },
    ];

    mockStorage.getAllVideos.mockResolvedValue(mockVideos);
    mockStorage.getAllChannels.mockResolvedValue([]);
    mockStorage.getAllLocalizedCategories.mockResolvedValue(mockCategories);
    mockStorage.getAllLocalizedTags.mockResolvedValue(mockTags);

    const response = await request(app).get("/api/seo/enhanced/sitemap");

    expect(response.status).toBe(200);
    expect(response.header["content-type"]).toContain("application/xml");
    
    const xml = response.text;
    
    // Check XML structure
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">');
    
    // Check Homepage
    expect(xml).toContain('<loc>https://nisam.video/</loc>');
    
    // Check Video
    expect(xml).toContain('<loc>https://nisam.video/video/test-video</loc>');
    expect(xml).toContain('<video:title>Test Video &amp; More</video:title>');
    expect(xml).toContain('<video:description>Test Description &lt;script&gt;</video:description>');
    expect(xml).toContain('<video:content_loc>https://www.youtube.com/watch?v=abc12345</video:content_loc>');
    
    // Check Category
    expect(xml).toContain('<loc>https://nisam.video/categories?filter=cat1</loc>');
    
    // Check Tag
    expect(xml).toContain('<loc>https://nisam.video/tag/tag-1</loc>');
  });

  it("should handle special characters in XML", async () => {
    const mockVideos = [
      {
        id: "1",
        title: "Video with \"quotes\" and 'apostrophes'",
        description: "Description with & ampersand",
        videoId: "123",
        thumbnailUrl: "http://example.com/thumb.jpg",
        slug: "special-chars",
        createdAt: new Date(),
      },
    ];

    mockStorage.getAllVideos.mockResolvedValue(mockVideos);
    mockStorage.getAllChannels.mockResolvedValue([]);
    mockStorage.getAllLocalizedCategories.mockResolvedValue([]);
    mockStorage.getAllLocalizedTags.mockResolvedValue([]);

    const response = await request(app).get("/api/seo/enhanced/sitemap");
    
    expect(response.status).toBe(200);
    const xml = response.text;
    
    expect(xml).toContain('Video with &quot;quotes&quot; and &apos;apostrophes&apos;');
    expect(xml).toContain('Description with &amp; ampersand');
  });
});
