import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock db to avoid connection attempts
vi.mock("../server/db.js", () => ({
  db: {
    execute: vi.fn(),
  },
  sql: { raw: vi.fn() },
}));

// Use vi.hoisted for variables used in mocks
const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    getHeroSettings: vi.fn(),
    updateHeroSettings: vi.fn(),
    getHeroImages: vi.fn(),
    upsertHeroImage: vi.fn(),
    getAllCategoriesWithTranslations: vi.fn(),
    listErrorEvents: vi.fn(),
  },
}));

vi.mock("../server/storage", () => ({
  storage: mockStorage,
}));

// Mock auth middleware
vi.mock("../server/middleware/auth.js", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: "admin", role: "admin" };
    next();
  },
}));

// Mock other dependencies used in admin.ts
vi.mock("../server/ai-service.js", () => ({
  categorizeVideo: vi.fn(),
  generateVideoSummary: vi.fn(),
  generateSeoMetadata: vi.fn(),
}));

vi.mock("../server/kv-service.js", () => ({
  kvService: {
    getStats: vi.fn(),
    flushAllViewBuffers: vi.fn(),
    cleanupRateLimits: vi.fn(),
  },
}));

// Import router AFTER mocks
import adminRouter from "../server/routes/admin";

const app = express();
app.use(express.json());
app.use("/api/admin", adminRouter);

describe("Admin Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Hero Configuration", () => {
    it("GET /hero/config returns settings", async () => {
      const mockSettings = { 
        rotationInterval: 5000, 
        animationType: "fade",
        fallbackImages: [],
        defaultPlaceholderUrl: "",
        enableRandom: true,
        enableImages: true
      };
      mockStorage.getHeroSettings.mockResolvedValue(mockSettings);

      const res = await request(app).get("/api/admin/hero/config");
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockSettings);
      expect(mockStorage.getHeroSettings).toHaveBeenCalled();
    });

    it("POST /hero/config updates settings", async () => {
      const newSettings = { rotationInterval: 3000 };
      const updatedSettings = { 
        rotationInterval: 3000, 
        animationType: "fade",
        fallbackImages: [],
        defaultPlaceholderUrl: "",
        enableRandom: true,
        enableImages: true
      };
      
      mockStorage.updateHeroSettings.mockResolvedValue(updatedSettings);

      const res = await request(app)
        .post("/api/admin/hero/config")
        .send(newSettings);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.settings).toEqual(updatedSettings);
      expect(mockStorage.updateHeroSettings).toHaveBeenCalledWith(expect.objectContaining(newSettings));
    });

    it("POST /hero/config validates input", async () => {
        const invalidSettings = { rotationInterval: "not-a-number" };
        
        const res = await request(app)
          .post("/api/admin/hero/config")
          .send(invalidSettings);
  
        expect(res.status).toBe(400);
        expect(mockStorage.updateHeroSettings).not.toHaveBeenCalled();
      });
  });

  describe("Hero Images", () => {
    it("GET /hero/images returns images", async () => {
      const mockImages = [{ id: "img1", url: "http://example.com/1.jpg" }];
      mockStorage.getHeroImages.mockResolvedValue(mockImages);

      const res = await request(app).get("/api/admin/hero/images");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockImages);
      expect(mockStorage.getHeroImages).toHaveBeenCalled();
    });

    it("POST /hero/images updates images", async () => {
      const newImages = [{ url: "http://example.com/2.jpg", alt: "Test", aspectRatio: "16:9", isActive: true }];
      const savedImage = { ...newImages[0], id: "img2" };
      
      mockStorage.upsertHeroImage.mockResolvedValue(savedImage);

      const res = await request(app)
        .post("/api/admin/hero/images")
        .send(newImages);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.images).toEqual([savedImage]);
      expect(mockStorage.upsertHeroImage).toHaveBeenCalledTimes(1);
    });
  });
});
