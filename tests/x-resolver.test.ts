import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Avoid module-level side effects from error-log-service touching the DB.
vi.mock("../server/error-log-service.js", () => ({
  recordError: vi.fn().mockResolvedValue(undefined),
}));

import {
  extractTweetId,
  syndicationToken,
  resolveXVideo,
} from "../server/x-resolver";

function makeFetchStub(handlers: Array<(url: string) => Promise<Response> | Response>) {
  let i = 0;
  return vi.fn(async (input: any) => {
    const url = typeof input === "string" ? input : input?.url;
    const handler = handlers[i] ?? handlers[handlers.length - 1];
    i += 1;
    return Promise.resolve(handler(url));
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("x-resolver: URL parsing", () => {
  it("extracts tweet id from x.com URL", () => {
    expect(extractTweetId("https://x.com/jack/status/1234567890123456789")).toBe(
      "1234567890123456789",
    );
  });

  it("extracts tweet id from twitter.com URL", () => {
    expect(
      extractTweetId("https://twitter.com/jack/status/1234567890123456789"),
    ).toBe("1234567890123456789");
  });

  it("accepts www and mobile subdomains", () => {
    expect(extractTweetId("https://www.x.com/u/status/42")).toBe("42");
    expect(extractTweetId("https://mobile.twitter.com/u/status/42")).toBe("42");
  });

  it("rejects non-tweet URLs", () => {
    expect(extractTweetId("https://x.com/jack")).toBeNull();
    expect(extractTweetId("https://example.com/jack/status/123")).toBeNull();
    expect(extractTweetId("not a url")).toBeNull();
  });
});

describe("x-resolver: token generation", () => {
  it("is deterministic for a given tweet id", () => {
    const a = syndicationToken("1234567890123456789");
    const b = syndicationToken("1234567890123456789");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-z0-9]+$/i);
  });

  it("produces a non-empty token for valid ids", () => {
    expect(syndicationToken("42").length).toBeGreaterThan(0);
  });

  it("falls back to a static token for non-numeric input", () => {
    expect(syndicationToken("not-a-number")).toBe("1");
  });
});

describe("x-resolver: resolveXVideo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("normalizes a video tweet from the syndication endpoint", async () => {
    const syndicationBody = {
      id_str: "1800000000000000001",
      text: "Check out this clip!\nLine two of the tweet.",
      created_at: "Mon May 12 09:30:00 +0000 2026",
      user: { name: "Sample User", screen_name: "sample_user" },
      mediaDetails: [
        {
          type: "video",
          media_url_https: "https://pbs.twimg.com/poster.jpg",
          video_info: {
            duration_millis: 15000,
            variants: [
              { content_type: "application/x-mpegURL", url: "https://video.twimg.com/x.m3u8" },
              { content_type: "video/mp4", bitrate: 320000, url: "https://video.twimg.com/low.mp4" },
              { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/high.mp4" },
            ],
          },
        },
      ],
    };

    const fetchStub = makeFetchStub([
      () => jsonResponse(syndicationBody), // syndication call
      () => jsonResponse({ html: "<blockquote>embed</blockquote>", author_name: "Sample User" }), // oEmbed
    ]);
    vi.stubGlobal("fetch", fetchStub);

    const result = await resolveXVideo(
      "https://x.com/sample_user/status/1800000000000000001",
    );

    expect(result.videoId).toBe("1800000000000000001");
    expect(result.permanentUrl).toBe("https://x.com/sample_user/status/1800000000000000001");
    expect(result.title).toBe("Check out this clip!");
    expect(result.description).toContain("Line two of the tweet.");
    expect(result.videoUrl).toBe("https://video.twimg.com/high.mp4"); // highest bitrate mp4
    expect(result.thumbnailUrl).toBe("https://pbs.twimg.com/poster.jpg");
    expect(result.durationSeconds).toBe(15);
    expect(result.publishDate).toBe("2026-05-12T09:30:00.000Z");
    expect(result.embedHtml).toBe("<blockquote>embed</blockquote>");
    expect(result.authorScreenName).toBe("sample_user");
    expect(result.authorName).toBe("Sample User");
  });

  it("rejects a photo-only tweet", async () => {
    const syndicationBody = {
      id_str: "1",
      text: "just a picture",
      user: { screen_name: "u" },
      mediaDetails: [
        {
          type: "photo",
          media_url_https: "https://pbs.twimg.com/photo.jpg",
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      makeFetchStub([
        () => jsonResponse(syndicationBody),
        () => jsonResponse({}),
      ]),
    );

    await expect(
      resolveXVideo("https://x.com/u/status/1"),
    ).rejects.toThrow(/does not contain a video/i);
  });

  it("rejects an invalid URL without making a network call", async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    await expect(resolveXVideo("https://example.com/u/status/1")).rejects.toThrow(
      /not a valid X post URL/i,
    );
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("retries when syndication first returns empty, then succeeds", async () => {
    const success = {
      id_str: "2",
      text: "retry win",
      user: { screen_name: "u" },
      mediaDetails: [
        {
          type: "video",
          media_url_https: "https://pbs.twimg.com/p.jpg",
          video_info: {
            duration_millis: 5000,
            variants: [
              { content_type: "video/mp4", bitrate: 1000, url: "https://video.twimg.com/v.mp4" },
            ],
          },
        },
      ],
    };

    // Calls now fire in parallel: [syndication, oEmbed] on the first try,
    // then a single sequential retry on the syndication endpoint when the
    // first one returns an empty body.
    vi.stubGlobal(
      "fetch",
      makeFetchStub([
        () => new Response("", { status: 200 }), // syndication (parallel call 1): empty
        () => jsonResponse({ html: "<blockquote/>" }), // oEmbed (parallel call 2)
        () => jsonResponse(success), // syndication retry: success
      ]),
    );

    const result = await resolveXVideo("https://x.com/u/status/2");
    expect(result.videoUrl).toBe("https://video.twimg.com/v.mp4");
  });

  it("throws when syndication consistently returns empty bodies", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub([
        () => new Response("", { status: 200 }),
        () => new Response("", { status: 200 }),
      ]),
    );

    await expect(
      resolveXVideo("https://x.com/u/status/3"),
    ).rejects.toThrow(/Could not load tweet data/i);
  });

  it("rejects a tombstoned tweet (response with no mediaDetails field at all)", async () => {
    // Deleted/suspended tweets often return a tombstone shape with user info
    // but no mediaDetails array. We currently surface this as the generic
    // "could not load tweet" error which is acceptable for v1.
    vi.stubGlobal(
      "fetch",
      makeFetchStub([
        () => jsonResponse({ id_str: "5", text: "gone", user: { screen_name: "u" } }),
        () => jsonResponse({}),
        () => jsonResponse({ id_str: "5", text: "gone", user: { screen_name: "u" } }),
      ]),
    );
    await expect(
      resolveXVideo("https://x.com/u/status/5"),
    ).rejects.toThrow(/Could not load tweet data/i);
  });

  it("rejects an animated_gif-only post (gifs are not playable mp4 videos)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub([
        () =>
          jsonResponse({
            id_str: "6",
            text: "gif",
            user: { screen_name: "u" },
            mediaDetails: [{ type: "animated_gif", media_url_https: "https://pbs.twimg.com/gif.jpg" }],
          }),
        () => jsonResponse({}),
      ]),
    );
    await expect(
      resolveXVideo("https://x.com/u/status/6"),
    ).rejects.toThrow(/does not contain a video/i);
  });

  it("rejects HLS-only videos with a clear, distinct error message", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchStub([
        () =>
          jsonResponse({
            id_str: "7",
            text: "hls",
            user: { screen_name: "u" },
            mediaDetails: [
              {
                type: "video",
                media_url_https: "https://pbs.twimg.com/p.jpg",
                video_info: {
                  duration_millis: 1000,
                  variants: [
                    { content_type: "application/x-mpegURL", url: "https://video.twimg.com/x.m3u8" },
                  ],
                },
              },
            ],
          }),
        () => jsonResponse({}),
      ]),
    );
    await expect(
      resolveXVideo("https://x.com/u/status/7"),
    ).rejects.toThrow(/HLS-only|unsupported/i);
  });

  it("truncates titles on a grapheme boundary so emoji are not split", async () => {
    // Build a string whose 120th code unit lands inside a surrogate pair.
    // 60 emoji × 2 code units = 120 code units. firstLine(max=120) used to
    // slice on the unit boundary; the grapheme-safe version must not.
    const emoji = "🎥";
    const text = emoji.repeat(60) + " trailing text";
    vi.stubGlobal(
      "fetch",
      makeFetchStub([
        () =>
          jsonResponse({
            id_str: "8",
            text,
            user: { screen_name: "u" },
            mediaDetails: [
              {
                type: "video",
                media_url_https: "https://pbs.twimg.com/p.jpg",
                video_info: {
                  duration_millis: 1000,
                  variants: [
                    { content_type: "video/mp4", bitrate: 1000, url: "https://video.twimg.com/v.mp4" },
                  ],
                },
              },
            ],
          }),
        () => jsonResponse({}),
      ]),
    );
    const result = await resolveXVideo("https://x.com/u/status/8");
    // Title is either the full string (if ≤120 graphemes) or ends in "…".
    // Crucially it must NOT contain the U+FFFD replacement character that
    // appears when UTF-16 is sliced mid-surrogate.
    expect(result.title).not.toContain("�");
    // And the truncated form must not contain a half-emoji.
    if (result.title.endsWith("…")) {
      expect([...result.title].every((c) => c !== "\uD83C" && c !== "\uD83D" && c !== "\uD83E")).toBe(true);
    }
  });
});
