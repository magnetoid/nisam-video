import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { categorizeVideo } from "../server/ai-service";
import { scrapeYouTubeChannel } from "../server/scraper";

// Mock database
vi.mock("../server/db.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        limit: () => Promise.resolve([{ ollamaUrl: "http://localhost:11434" }]),
      }),
    }),
  },
}));

vi.mock("../server/error-log-service.js", () => ({
  recordError: vi.fn(),
}));

describe("AI Service Validation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should successfully parse valid JSON response from Ollama", async () => {
    const validResponse = {
      response: JSON.stringify({
        categories: ["Technology"],
        tags: ["AI", "Coding"]
      })
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    });

    const result = await categorizeVideo("Test Video", "Description");
    expect(result.categories).toEqual(["Technology"]);
    expect(result.tags).toEqual(["AI", "Coding"]);
  });

  it("should clean up and parse markdown-wrapped JSON", async () => {
    const markdownResponse = {
      response: "```json\n{\"categories\": [\"Tech\"], \"tags\": [\"Code\"]}\n```"
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(markdownResponse),
    });

    const result = await categorizeVideo("Test Video", "Description");
    expect(result.categories).toEqual(["Tech"]);
    expect(result.tags).toEqual(["Code"]);
  });

  it("should throw error for invalid schema types", async () => {
    const invalidResponse = {
      response: JSON.stringify({
        categories: "Not an array", // Type mismatch
        tags: [123] // Array of numbers instead of strings
      })
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(invalidResponse),
    });

    await expect(categorizeVideo("Test Video", "Description"))
      .rejects.toThrow("Invalid JSON schema");
  });
});

describe("YouTube Scraper", () => {
    const originalFetch = global.fetch;
  
    beforeEach(() => {
      global.fetch = vi.fn();
    });
  
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should extract ytInitialData from variable declaration", async () => {
        const mockHtml = `
            <html>
                <body>
                    <script>var ytInitialData = { "header": { "c4TabbedHeaderRenderer": { "title": "Test Channel", "channelId": "123" } } };</script>
                </body>
            </html>
        `;

        (global.fetch as any).mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        });

        const result = await scrapeYouTubeChannel("https://youtube.com/test");
        expect(result.channelInfo.channelName).toBe("Test Channel");
        expect(result.channelInfo.channelId).toBe("123");
    });

    it("should extract ytInitialData from window assignment", async () => {
        const mockHtml = `
            <html>
                <body>
                    <script>window["ytInitialData"] = { "header": { "c4TabbedHeaderRenderer": { "title": "Window Channel", "channelId": "456" } } };</script>
                </body>
            </html>
        `;

        (global.fetch as any).mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        });

        const result = await scrapeYouTubeChannel("https://youtube.com/test2");
        expect(result.channelInfo.channelName).toBe("Window Channel");
        expect(result.channelInfo.channelId).toBe("456");
    });

    it("should fallback to meta tags if JSON missing", async () => {
         const mockHtml = `
            <html>
                <head>
                    <meta property="og:title" content="Meta Channel" />
                    <meta property="og:image" content="http://example.com/thumb.jpg" />
                </head>
                <body></body>
            </html>
        `;

        (global.fetch as any).mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        });

        // It throws because no videos are found, but we want to check if it extracted channel info first
        // In the real code, it throws "No channel info or videos found" if BOTH are missing.
        // But here we have channel info, so it might throw "No channel info or videos found" only if videos are empty AND channel name is empty?
        // Let's check the logic: if (!channelInfo.channelName && !videos.length)
        // So if channelName is present, it should return { channelInfo, videos: [] }
        
        const result = await scrapeYouTubeChannel("https://youtube.com/test3");
        expect(result.channelInfo.channelName).toBe("Meta Channel");
        expect(result.channelInfo.thumbnailUrl).toBe("http://example.com/thumb.jpg");
        expect(result.videos).toEqual([]);
    });
});
