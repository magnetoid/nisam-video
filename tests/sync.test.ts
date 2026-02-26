import { describe, it, expect, vi, beforeEach } from "vitest";
import { processScrapedVideos } from "../server/video-ingestion";
import { storage } from "../server/storage";

// Mock storage
vi.mock("../server/storage", () => ({
  storage: {
    getVideoByVideoId: vi.fn(),
    getVideoBySlug: vi.fn(),
    createVideo: vi.fn(),
    addVideoCategory: vi.fn(),
    createCategory: vi.fn(),
    getLocalizedCategoryBySlug: vi.fn(),
    createTag: vi.fn(),
    getVideo: vi.fn(),
  },
}));

// Mock ai-service
vi.mock("../server/ai-service", () => ({
  categorizeVideo: vi.fn().mockResolvedValue({
    categories: ["Test Category"],
    tags: ["Test Tag"],
  }),
}));

describe("Sync Reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should deduplicate videos based on videoId", async () => {
    const scrapedVideos = [
      {
        videoId: "v1",
        title: "Video 1",
        thumbnailUrl: "thumb1",
        videoType: "regular",
      },
    ];

    // Mock existing video
    (storage.getVideoByVideoId as any).mockResolvedValue({ id: "existing-id" });

    const result = await processScrapedVideos(scrapedVideos as any, {
      channelId: "c1",
      platform: "youtube",
    });

    expect(result.savedCount).toBe(0);
    expect(storage.createVideo).not.toHaveBeenCalled();
  });

  it("should create new videos with unique slugs", async () => {
    const scrapedVideos = [
      {
        videoId: "v2",
        title: "New Video",
        thumbnailUrl: "thumb2",
        videoType: "regular",
      },
    ];

    (storage.getVideoByVideoId as any).mockResolvedValue(null);
    (storage.getVideoBySlug as any).mockResolvedValueOnce(null); // No slug conflict
    (storage.createVideo as any).mockResolvedValue({ id: "new-id" });

    const result = await processScrapedVideos(scrapedVideos as any, {
      channelId: "c1",
      platform: "youtube",
    });

    expect(result.savedCount).toBe(1);
    expect(storage.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      videoId: "v2",
      slug: "new-video",
    }));
  });

  it("should handle slug collisions", async () => {
    const scrapedVideos = [
      {
        videoId: "v3",
        title: "Collision Video",
        thumbnailUrl: "thumb3",
        videoType: "regular",
      },
    ];

    (storage.getVideoByVideoId as any).mockResolvedValue(null);
    // First call finds existing slug, second call finds nothing
    (storage.getVideoBySlug as any)
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);
    (storage.createVideo as any).mockResolvedValue({ id: "new-id" });

    const result = await processScrapedVideos(scrapedVideos as any, {
      channelId: "c1",
      platform: "youtube",
    });

    expect(result.savedCount).toBe(1);
    expect(storage.createVideo).toHaveBeenCalledWith(expect.objectContaining({
      slug: "collision-video-1",
    }));
  });
});
