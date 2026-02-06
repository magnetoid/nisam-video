import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import { z } from "zod";
import { db } from "./db.js";
import { aiSettings } from "../shared/schema.js";
import { recordError } from "./error-log-service.js";

// Helper to get configured Ollama URL
async function getOllamaConfig() {
  try {
    const settings = await db.select().from(aiSettings).limit(1);
    const config = settings[0];
    
    // Default to localhost if not set
    const url = config?.ollamaUrl || "http://localhost:11434";
    const model = config?.ollamaModel || "llama3";
    
    // Ensure URL doesn't have trailing slash
    return {
      url: url.replace(/\/$/, ""),
      model
    };
  } catch (error: any) {
    // Suppress "relation does not exist" error (code 42P01)
    if (error?.code === '42P01') {
      console.warn("AI Settings table not found, using defaults.");
    } else {
      console.error("Error getting AI config, falling back to default:", error);
    }
    return {
      url: "http://localhost:11434",
      model: "llama3"
    };
  }
}

// Validation schemas
const CategorizationSchema = z.object({
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

const SeoSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  keywords: z.array(z.string()).default([]),
});

// Minimal Ollama Client
async function ollamaGenerate(prompt: string, options: { model: string; url: string; format?: string; signal?: AbortSignal }) {
  try {
    // Fast-fail for localhost on Vercel
    if (process.env.VERCEL === '1' && (options.url.includes('localhost') || options.url.includes('127.0.0.1'))) {
       throw new Error("Cannot connect to localhost Ollama on Vercel. Please configure a remote Ollama URL or use OpenAI.");
    }

    const response = await fetch(`${options.url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        prompt: prompt,
        stream: false,
        format: options.format, // "json" or undefined
        options: {
          num_ctx: 4096, // Increase context window
          temperature: 0.7
        }
      }),
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.response;
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED') {
       throw new Error(`Ollama connection failed (ECONNREFUSED) at ${options.url}. Is Ollama running?`);
    }
    throw error;
  }
}

export interface VideoCategorizationResult {
  categories: string[];
  tags: string[];
}

export async function categorizeVideo(
  title: string,
  description: string,
  opts?: { timeoutMs?: number },
): Promise<VideoCategorizationResult> {
  const limit = pLimit(1);
  const timeoutMs = opts?.timeoutMs;

  return limit(() =>
    pRetry(
      async () => {
        try {
          const config = await getOllamaConfig();
          
          const prompt = `Analyze this video and provide categories and tags.

Title: ${title}
Description: ${description || "No description"}

Return a JSON object with:
- categories: array of 1-3 broad categories (e.g., "Technology", "Education", "Entertainment")
- tags: array of 3-8 specific descriptive tags

Example JSON:
{
  "categories": ["Technology"],
  "tags": ["AI", "Coding", "Tutorial"]
}

Return ONLY valid JSON. Do not include markdown formatting or explanations.`;

          const content = await ollamaGenerate(prompt, {
            model: config.model,
            url: config.url,
            format: "json",
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
          });

          let result;
          try {
            // Clean up common JSON issues from LLMs
            const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
            result = JSON.parse(cleaned);
          } catch (e) {
            throw new Error(`Failed to parse JSON response: ${content.substring(0, 100)}...`);
          }

          const parsed = CategorizationSchema.safeParse(result);
          if (!parsed.success) {
             throw new Error(`Invalid JSON schema: ${parsed.error.message}`);
          }

          return {
            categories: parsed.data.categories,
            tags: parsed.data.tags,
          };
        } catch (error: any) {
          console.error("Ollama categorization error:", error);
          await recordError({
            level: "error",
            type: "ai_categorization_failed",
            message: error.message,
            module: "ai-service",
            context: { title, error: String(error) }
          });
          throw new AbortError(error);
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
            console.error("Batch categorization error:", error);
            // Return empty fallback on failure
            return { categories: [], tags: [] };
          }
        },
        {
          retries: 3,
          minTimeout: 2000,
        },
      ),
    ),
  );

  return await Promise.all(categorizationPromises);
}

export async function generateVideoSummary(
  title: string,
  description: string,
  opts?: { timeoutMs?: number },
): Promise<string> {
  const limit = pLimit(1);
  const timeoutMs = opts?.timeoutMs;

  return limit(() =>
    pRetry(
      async () => {
        try {
          const config = await getOllamaConfig();
          
          const prompt = `Summarize this video content in a concise, engaging paragraph (max 150 words).

Title: ${title}
Description: ${description || "No description"}

Summary:`;

          const content = await ollamaGenerate(prompt, {
            model: config.model,
            url: config.url,
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
          });

          return content.trim() || "No summary available.";
        } catch (error: any) {
          console.error("Ollama summary error:", error);
          await recordError({
            level: "error",
            type: "ai_summary_failed",
            message: error.message,
            module: "ai-service",
            context: { title, error: String(error) }
          });
          return `Summary for "${title}": This video covers interesting topics related to its title. (AI summary unavailable)`;
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
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
  opts?: { timeoutMs?: number },
): Promise<SeoMetadataResult> {
  const limit = pLimit(1);
  const timeoutMs = opts?.timeoutMs;

  return limit(() =>
    pRetry(
      async () => {
        try {
          const config = await getOllamaConfig();
          
          const prompt = `Generate SEO metadata for this video.

Title: ${title}
Description: ${description || "No description"}

Return a JSON object with:
- title: SEO-optimized title (max 60 chars)
- description: SEO-optimized description (max 160 chars)
- keywords: array of 5-10 relevant keywords

Example JSON:
{
  "title": "Optimized Title",
  "description": "Optimized description.",
  "keywords": ["keyword1", "keyword2"]
}

Return ONLY valid JSON.`;

          const content = await ollamaGenerate(prompt, {
            model: config.model,
            url: config.url,
            format: "json",
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
          });

          let result;
          try {
            const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
            result = JSON.parse(cleaned);
          } catch (e) {
             throw new Error(`Failed to parse JSON response`);
          }

          const parsed = SeoSchema.safeParse(result);
          if (!parsed.success) {
             // Fallback to partial data if possible
             return {
                title: (result?.title || title).substring(0, 60),
                description: (result?.description || description).substring(0, 160),
                keywords: Array.isArray(result?.keywords) ? result.keywords : []
             };
          }

          return {
            title: parsed.data.title || title.substring(0, 60),
            description: parsed.data.description || description.substring(0, 160),
            keywords: parsed.data.keywords,
          };
        } catch (error: any) {
          console.error("Ollama SEO error:", error);
          await recordError({
            level: "error",
            type: "ai_seo_failed",
            message: error.message,
            module: "ai-service",
            context: { title, error: String(error) }
          });
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
      },
    ),
  );
}
