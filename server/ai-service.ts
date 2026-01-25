// Reference: javascript_openai_ai_integrations blueprint
import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

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
