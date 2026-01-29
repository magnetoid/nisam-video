// Reference: javascript_openai_ai_integrations blueprint
import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// Initialize OpenAI or Mock
export let openai: OpenAI;

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (apiKey) {
  openai = new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: apiKey,
  });
} else {
  console.warn("OPENAI_API_KEY not set. Using Mock OpenAI service.");
  // Mock OpenAI client
  openai = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  categories: ["Uncategorized"],
                  tags: ["demo", "mock"],
                }),
              },
            },
          ],
        }),
      },
    },
    images: {
        generate: async () => ({
            data: [{ url: "https://placehold.co/1792x1024" }]
        })
    }
  } as unknown as OpenAI;
}

// Helper function to check if error is rate limit or quota violation
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export interface VideoCategorizationResult {
  categories: string[];
  tags: string[];
}

export async function categorizeVideo(
  title: string,
  description: string,
): Promise<VideoCategorizationResult> {
  const limit = pLimit(1);

  return limit(() =>
    pRetry(
      async () => {
        try {
          const prompt = `Analyze this video and provide categories and tags.

Title: ${title}
Description: ${description || "No description"}

Return a JSON object with:
- categories: array of 1-3 broad categories (e.g., "Technology", "Education", "Entertainment")
- tags: array of 3-8 specific descriptive tags

Return only valid JSON, no markdown formatting.`;

          // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
          const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_completion_tokens: 8192,
          });

          const content = response.choices[0]?.message?.content || "{}";
          const result = JSON.parse(content);

          return {
            categories: Array.isArray(result.categories)
              ? result.categories
              : [],
            tags: Array.isArray(result.tags) ? result.tags : [],
          };
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error; // Rethrow to trigger p-retry
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      },
    ),
  );
}

export async function batchCategorizeVideos(
  videos: Array<{ title: string; description: string }>,
): Promise<VideoCategorizationResult[]> {
  const limit = pLimit(2);

  const categorizationPromises = videos.map((video) =>
    limit(() =>
      pRetry(
        async () => {
          try {
            return await categorizeVideo(video.title, video.description);
          } catch (error: any) {
            if (isRateLimitError(error)) {
              throw error;
            }
            throw new AbortError(error);
          }
        },
        {
          retries: 7,
          minTimeout: 2000,
          maxTimeout: 128000,
          factor: 2,
        },
      ),
    ),
  );

  return await Promise.all(categorizationPromises);
}

export async function generateVideoSummary(
  title: string,
  description: string,
): Promise<string> {
  const limit = pLimit(1);

  return limit(() =>
    pRetry(
      async () => {
        try {
          const prompt = `Summarize this video content in a concise, engaging paragraph (max 150 words).

Title: ${title}
Description: ${description || "No description"}

Summary:`;

          const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [{ role: "user", content: prompt }],
            max_completion_tokens: 250,
          });

          return response.choices[0]?.message?.content || "No summary available.";
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          // Fallback for mock/error
          return `Summary for "${title}": This video covers interesting topics related to its title. (AI summary unavailable)`;
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        factor: 2,
      },
    ),
  );
}

export interface SeoMetadataResult {
  title: string;
  description: string;
  keywords: string[];
}

export async function generateSeoMetadata(
  title: string,
  description: string,
): Promise<SeoMetadataResult> {
  const limit = pLimit(1);

  return limit(() =>
    pRetry(
      async () => {
        try {
          const prompt = `Generate SEO metadata for this video.

Title: ${title}
Description: ${description || "No description"}

Return a JSON object with:
- title: SEO-optimized title (max 60 chars)
- description: SEO-optimized description (max 160 chars)
- keywords: array of 5-10 relevant keywords

Return only valid JSON.`;

          const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_completion_tokens: 1000,
          });

          const content = response.choices[0]?.message?.content || "{}";
          const result = JSON.parse(content);

          return {
            title: result.title || title.substring(0, 60),
            description: result.description || description.substring(0, 160),
            keywords: Array.isArray(result.keywords) ? result.keywords : [],
          };
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          // Fallback
          return {
            title: title.substring(0, 60),
            description: description.substring(0, 160),
            keywords: ["video", "content"],
          };
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        factor: 2,
      },
    ),
  );
}
