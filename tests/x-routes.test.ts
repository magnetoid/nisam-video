import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockStorage, mockResolve } = vi.hoisted(() => ({
  mockStorage: {
    createChannel: vi.fn(),
    createVideo: vi.fn(),
  },
  mockResolve: vi.fn(),
}));

vi.mock("../server/storage/index.js", () => ({ storage: mockStorage }));
vi.mock("../server/storage", () => ({ storage: mockStorage }));

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

describe("X admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("POST /preview returns 400 when resolver rejects", async () => {
    mockResolve.mockRejectedValueOnce(new Error("This X post does not contain a video"));

    const res = await request(app)
      .post("/api/admin/x/preview")
      .send({ url: "https://x.com/u/status/1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not contain a video/i);
  });

  it("POST /preview returns 400 for invalid body", async () => {
    const res = await request(app).post("/api/admin/x/preview").send({});
    expect(res.status).toBe(400);
  });

  it("POST /videos upserts a channel and creates a video", async () => {
    mockResolve.mockResolvedValueOnce({
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
    });
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
