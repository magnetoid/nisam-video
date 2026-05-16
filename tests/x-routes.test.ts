import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockStorage, mockResolve, mockDbInsert, mockCategorize } = vi.hoisted(() => ({
  mockStorage: {
    createChannel: vi.fn(),
    createVideo: vi.fn(),
    getVideoByVideoId: vi.fn(),
    // Categorize fire-and-forget path — return undefined to short-circuit.
    getVideo: vi.fn().mockResolvedValue(undefined),
    getLocalizedCategoryBySlug: vi.fn(),
    createCategory: vi.fn(),
    addCategoryTranslation: vi.fn(),
    addVideoCategory: vi.fn(),
  },
  mockResolve: vi.fn(),
  // Chainable db.insert(...).values(...) — both .values() and .returning() resolve.
  mockDbInsert: vi.fn(() => ({
    values: vi.fn().mockResolvedValue(undefined),
  })),
  mockCategorize: vi.fn().mockResolvedValue({
    categories: { en: [], sr: [] },
    tags: { en: [], sr: [] },
  }),
}));

vi.mock("../server/storage/index.js", () => ({ storage: mockStorage }));
vi.mock("../server/storage", () => ({ storage: mockStorage }));

vi.mock("../server/db.js", () => ({
  db: { insert: mockDbInsert },
}));

vi.mock("../server/ai-service.js", () => ({
  categorizeVideo: mockCategorize,
}));

vi.mock("../server/middleware/auth.js", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../server/x-resolver.js", async () => {
  const actual = await vi.importActual<typeof import("../server/x-resolver")>(
    "../server/x-resolver",
  );
  return {
    ...actual,
    resolveXVideo: mockResolve,
  };
});

import xRouter from "../server/routes/x";

const app = express();
app.use(express.json());
app.use("/api/admin/x", xRouter);

const resolvedVideoSample = {
  videoId: "1800000000000000042",
  permanentUrl: "https://x.com/u/status/1800000000000000042",
  title: "Tweet title",
  description: "Tweet body",
  thumbnailUrl: "https://pbs.twimg.com/p.jpg",
  videoUrl: "https://video.twimg.com/v.mp4",
  durationSeconds: 30,
  publishDate: "2026-04-01T00:00:00.000Z",
  authorScreenName: "u",
  authorName: "User",
};

describe("X admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getVideoByVideoId.mockResolvedValue(undefined);
  });

  it("POST /preview returns normalized metadata for a video tweet", async () => {
    mockResolve.mockResolvedValueOnce({
      videoId: "42",
      permanentUrl: "https://x.com/u/status/42",
      title: "Hello",
      description: "Hello world",
      thumbnailUrl: "https://pbs.twimg.com/p.jpg",
      videoUrl: "https://video.twimg.com/v.mp4",
      durationSeconds: 12,
      publishDate: "2026-01-01T00:00:00.000Z",
      authorScreenName: "u",
      authorName: "User",
    });

    const res = await request(app)
      .post("/api/admin/x/preview")
      .send({ url: "https://x.com/u/status/42" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.tweetId).toBe("42");
    expect(res.body.videoUrl).toBe("https://video.twimg.com/v.mp4");
    expect(res.body.author).toEqual({ screenName: "u", name: "User" });
  });

  it("POST /preview returns 400 with the resolver message for known errors", async () => {
    mockResolve.mockRejectedValueOnce(new Error("This X post does not contain a video"));

    const res = await request(app)
      .post("/api/admin/x/preview")
      .send({ url: "https://x.com/u/status/1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not contain a video/i);
  });

  it("POST /preview returns 500 with a generic message for unexpected errors", async () => {
    // Simulates a DB connection error message escaping from inside the resolver
    // — we should never leak it to the client.
    mockResolve.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5432"));

    const res = await request(app)
      .post("/api/admin/x/preview")
      .send({ url: "https://x.com/u/status/1" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to resolve X video");
  });

  it("POST /preview returns 400 for invalid body", async () => {
    const res = await request(app).post("/api/admin/x/preview").send({});
    expect(res.status).toBe(400);
  });

  it("POST /videos upserts a channel and creates a video", async () => {
    mockResolve.mockResolvedValueOnce(resolvedVideoSample);
    mockStorage.createChannel.mockResolvedValueOnce({ id: "ch-1" });
    mockStorage.createVideo.mockResolvedValueOnce({ id: "v-1" });

    const res = await request(app)
      .post("/api/admin/x/videos")
      .send({ url: "https://x.com/u/status/1800000000000000042" });

    expect(res.status).toBe(201);
    expect(res.body.video).toEqual({ id: "v-1" });
    expect(res.body.channel).toEqual({ id: "ch-1" });

    expect(mockStorage.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "x",
        url: "https://x.com/u",
        channelId: "u",
        name: "User",
      }),
    );

    const videoArg = mockStorage.createVideo.mock.calls[0][0];
    expect(videoArg.channelId).toBe("ch-1");
    expect(videoArg.videoType).toBe("x");
    expect(videoArg.videoId).toBe("x_1800000000000000042");
    expect(videoArg.embedUrl).toBe("https://video.twimg.com/v.mp4");
    expect(videoArg.slug).toMatch(/-00000042$/);
  });

  it("POST /videos writes an audit log entry on success", async () => {
    mockResolve.mockResolvedValueOnce(resolvedVideoSample);
    mockStorage.createChannel.mockResolvedValueOnce({ id: "ch-1" });
    mockStorage.createVideo.mockResolvedValueOnce({ id: "v-1" });

    const res = await request(app)
      .post("/api/admin/x/videos")
      .send({ url: "https://x.com/u/status/1800000000000000042" });

    expect(res.status).toBe(201);
    expect(mockDbInsert).toHaveBeenCalled();
    const valuesCall = mockDbInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "x.import_video",
        entityType: "video",
        entityId: "v-1",
      }),
    );
  });

  it("POST /videos returns 409 when the tweet has already been imported (pre-check)", async () => {
    mockResolve.mockResolvedValueOnce(resolvedVideoSample);
    mockStorage.getVideoByVideoId.mockResolvedValueOnce({ id: "existing-v" });

    const res = await request(app)
      .post("/api/admin/x/videos")
      .send({ url: "https://x.com/u/status/1800000000000000042" });

    expect(res.status).toBe(409);
    expect(res.body.video).toEqual({ id: "existing-v" });
    // Channel insert must not be attempted when the video already exists.
    expect(mockStorage.createChannel).not.toHaveBeenCalled();
    expect(mockStorage.createVideo).not.toHaveBeenCalled();
  });

  it("POST /videos returns 409 when createVideo races on a unique constraint", async () => {
    mockResolve.mockResolvedValueOnce(resolvedVideoSample);
    mockStorage.createChannel.mockResolvedValueOnce({ id: "ch-1" });
    const pgUniqueViolation: any = new Error("duplicate key value violates unique constraint");
    pgUniqueViolation.code = "23505";
    mockStorage.createVideo.mockRejectedValueOnce(pgUniqueViolation);
    mockStorage.getVideoByVideoId
      .mockResolvedValueOnce(undefined) // pre-check
      .mockResolvedValueOnce({ id: "winner-v" }); // post-race lookup

    const res = await request(app)
      .post("/api/admin/x/videos")
      .send({ url: "https://x.com/u/status/1800000000000000042" });

    expect(res.status).toBe(409);
    expect(res.body.video).toEqual({ id: "winner-v" });
  });

  it("POST /videos rejects upstream resolver errors with 400", async () => {
    mockResolve.mockRejectedValueOnce(new Error("This X post does not contain a video."));

    const res = await request(app)
      .post("/api/admin/x/videos")
      .send({ url: "https://x.com/u/status/1" });

    expect(res.status).toBe(400);
    expect(mockStorage.createChannel).not.toHaveBeenCalled();
  });

  it("POST /validate-url accepts a valid tweet URL without network", async () => {
    const res = await request(app)
      .post("/api/admin/x/validate-url")
      .send({ url: "https://x.com/jack/status/123" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, tweetId: "123" });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("POST /validate-url rejects non-tweet URL", async () => {
    const res = await request(app)
      .post("/api/admin/x/validate-url")
      .send({ url: "https://x.com/jack" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, tweetId: null });
  });
});
