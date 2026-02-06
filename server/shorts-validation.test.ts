import { describe, expect, it } from "vitest";
import { isEligibleShortsVideo, isShortsChannelUrl } from "./shorts-validation";

describe("shorts-validation", () => {
  describe("isShortsChannelUrl", () => {
    it("returns true for /shorts and /shorts/", () => {
      expect(isShortsChannelUrl("https://www.youtube.com/@foo/shorts")).toBe(true);
      expect(isShortsChannelUrl("https://www.youtube.com/@foo/shorts/")).toBe(true);
    });

    it("returns true for query string variants", () => {
      expect(isShortsChannelUrl("https://www.youtube.com/@foo/shorts?view=0")).toBe(true);
    });

    it("returns false for non-shorts channel URLs", () => {
      expect(isShortsChannelUrl("https://www.youtube.com/@foo/videos")).toBe(false);
      expect(isShortsChannelUrl("https://www.youtube.com/@foo")).toBe(false);
      expect(isShortsChannelUrl("")).toBe(false);
      expect(isShortsChannelUrl(null)).toBe(false);
    });
  });

  describe("isEligibleShortsVideo", () => {
    it("allows TikTok entries", () => {
      expect(
        isEligibleShortsVideo({
          videoType: "tiktok" as any,
          channel: { url: "https://tiktok.com/@x" } as any,
        }),
      ).toBe(true);
    });

    it("allows YouTube shorts only for /shorts channel URLs", () => {
      expect(
        isEligibleShortsVideo({
          videoType: "youtube_short" as any,
          channel: { url: "https://www.youtube.com/@foo/shorts" } as any,
        }),
      ).toBe(true);

      expect(
        isEligibleShortsVideo({
          videoType: "youtube_short" as any,
          channel: { url: "https://www.youtube.com/@foo/videos" } as any,
        }),
      ).toBe(false);
    });

    it("rejects regular YouTube videos even on /shorts URLs", () => {
      expect(
        isEligibleShortsVideo({
          videoType: "regular" as any,
          channel: { url: "https://www.youtube.com/@foo/shorts" } as any,
        }),
      ).toBe(false);
    });
  });
});

