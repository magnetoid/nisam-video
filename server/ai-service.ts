import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import { z } from "zod";
import { db } from "./db.js";
import { aiSettings } from "../shared/schema.js";
import { recordError } from "./error-log-service.js";

async function getAiConfig() {
  try {
    const settings = await db.select().from(aiSettings).limit(1);
    const config = settings[0];

    const provider = (config?.provider || "ollama") as "ollama" | "openai";

    const rawOllamaUrl = (config?.ollamaUrl || "http://localhost:11434").trim();
    const ollamaUrl = (() => {
      if (!rawOllamaUrl) return "http://localhost:11434";
      if (!/^https?:\/\//i.test(rawOllamaUrl)) return "http://localhost:11434";
      try {
        new URL(rawOllamaUrl);
        return rawOllamaUrl;
      } catch {
        return "http://localhost:11434";
      }
    })().replace(/\/$/, "");

    const openaiBaseUrlRaw = (config?.openaiBaseUrl || "https://api.openai.com/v1").trim();
    const openaiBaseUrl = (() => {
      if (!openaiBaseUrlRaw) return "https://api.openai.com/v1";
      if (!/^https?:\/\//i.test(openaiBaseUrlRaw)) return "https://api.openai.com/v1";
      try {
        new URL(openaiBaseUrlRaw);
        return openaiBaseUrlRaw;
      } catch {
        return "https://api.openai.com/v1";
      }
    })().replace(/\/+$/, "");

    return {
      provider,
      ollama: {
        url: ollamaUrl,
        model: config?.ollamaModel || "llama3",
        apiKey: config?.ollamaApiKey,
      },
      openai: {
        baseUrl: openaiBaseUrl,
        model: config?.openaiModel || "gpt-4o-mini",
        apiKey: config?.openaiApiKey,
      },
    };
  } catch (error: any) {
    // Suppress "relation does not exist" error (code 42P01)
    if (error?.code === '42P01') {
      console.warn("AI Settings table not found, using defaults.");
    } else if (error?.code === '42703') {
      console.warn("AI Settings columns missing, using defaults.");
    } else {
      console.error("Error getting AI config, falling back to default:", error);
    }
    return {
      provider: "ollama" as const,
      ollama: {
        url: "http://localhost:11434",
        model: "llama3",
        apiKey: undefined,
      },
      openai: {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        apiKey: undefined,
      },
    };
  }
}

// Remove old schema
// const CategorizationSchema = z.object({
//   categories: z.array(z.string()).default([]),
//   tags: z.array(z.string()).default([]),
// });

const SeoSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  keywords: z.array(z.string()).default([]),
});

// Minimal Ollama Client
async function ollamaGenerate(prompt: string, options: { model: string; url: string; apiKey?: string | null; format?: string; signal?: AbortSignal }) {
  try {
    // Fast-fail for localhost on Vercel
    if (process.env.VERCEL === '1' && (options.url.includes('localhost') || options.url.includes('127.0.0.1'))) {
       throw new Error("Cannot connect to localhost Ollama on Vercel. Please configure a remote Ollama URL or use OpenAI.");
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    // Use /api/chat instead of /api/generate for better compatibility with Cloud models
    const response = await fetch(`${options.url}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: [{ role: "user", content: prompt }],
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
    return data.message?.content || "";
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED') {
       throw new Error(`Ollama connection failed (ECONNREFUSED) at ${options.url}. Is Ollama running?`);
    }
    throw error;
  }
}

async function openaiGenerate(
  prompt: string,
  options: { model: string; baseUrl: string; apiKey?: string | null; signal?: AbortSignal },
) {
  if (!options.apiKey) {
    throw new Error("OpenAI API key is missing. Set it in Admin → AI Settings.");
  }

  const res = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const snippet = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText}${snippet ? ` - ${snippet}` : ""}`);
  }

  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI API response missing message content");
  }
  return content;
}

export interface VideoCategorizationResult {
  categories: {
    en: string[];
    sr: string[];
  };
  tags: {
    en: string[];
    sr: string[];
  };
}

const CategorizationSchema = z.object({
  categories_en: z.array(z.string()).default([]),
  categories_sr: z.array(z.string()).default([]),
  tags_en: z.array(z.string()).default([]),
  tags_sr: z.array(z.string()).default([]),
});

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
          const config = await getAiConfig();
          
          const prompt = `Analyze this video and provide categories and tags in both English and Serbian.

Title: ${title}
Description: ${description || "No description"}

Return a JSON object with:
- categories_en: array of up to 5 broad categories in English
- categories_sr: array of up to 5 broad categories in Serbian (Latin script)
- tags_en: array of up to 5 specific descriptive tags in English
- tags_sr: array of up to 5 specific descriptive tags in Serbian (Latin script)

Example JSON:
{
  "categories_en": ["Technology", "Education"],
  "categories_sr": ["Tehnologija", "Obrazovanje"],
  "tags_en": ["AI", "Coding"],
  "tags_sr": ["Veštačka inteligencija", "Programiranje"]
}

Return ONLY valid JSON. Do not include markdown formatting or explanations.`;

          const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
          const content =
            config.provider === "openai"
              ? await openaiGenerate(prompt, {
                  model: config.openai.model,
                  baseUrl: config.openai.baseUrl,
                  apiKey: config.openai.apiKey,
                  signal,
                })
              : await ollamaGenerate(prompt, {
                  model: config.ollama.model,
                  url: config.ollama.url,
                  apiKey: config.ollama.apiKey,
                  format: "json",
                  signal,
                });

          let result;
          try {
            // Clean up common JSON issues from LLMs
            const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
            result = JSON.parse(cleaned);
          } catch (e) {
            throw new Error(`Failed to parse JSON response: ${content.substring(0, 100)}...`);
          }

          // Support legacy format fallback if model returns old format
          if (result.categories && !result.categories_en) {
             result.categories_en = result.categories;
             result.categories_sr = [];
          }
          if (result.tags && !result.tags_en) {
             result.tags_en = result.tags;
             result.tags_sr = [];
          }

          const parsed = CategorizationSchema.safeParse(result);
          if (!parsed.success) {
             throw new Error(`Invalid JSON schema: ${parsed.error.message}`);
          }

          return {
            categories: {
              en: parsed.data.categories_en,
              sr: parsed.data.categories_sr
            },
            tags: {
              en: parsed.data.tags_en,
              sr: parsed.data.tags_sr
            },
          };
        } catch (error: any) {
          const message = typeof error?.message === "string" ? error.message : String(error);
          const isProviderUnavailable =
            message.includes("Cannot connect to localhost Ollama on Vercel") ||
            message.includes("Failed to parse URL") ||
            message.includes("ERR_INVALID_URL");

          if (isProviderUnavailable) {
            console.warn("Ollama categorization unavailable:", message);
            await recordError({
              level: "warn",
              type: "ai_provider_unavailable",
              message,
              module: "ai-service",
              context: { title }
            });
            throw new AbortError(new Error(message));
          }

          console.error("Ollama categorization error:", error);
          await recordError({
            level: "error",
            type: "ai_categorization_failed",
            message,
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
            return { 
              categories: { en: [], sr: [] }, 
              tags: { en: [], sr: [] } 
            };
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
          const config = await getAiConfig();
          
          const prompt = `Summarize this video content in a concise, engaging paragraph (max 150 words).

Title: ${title}
Description: ${description || "No description"}

Summary:`;

          const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
          const content =
            config.provider === "openai"
              ? await openaiGenerate(prompt, {
                  model: config.openai.model,
                  baseUrl: config.openai.baseUrl,
                  apiKey: config.openai.apiKey,
                  signal,
                })
              : await ollamaGenerate(prompt, {
                  model: config.ollama.model,
                  url: config.ollama.url,
                  apiKey: config.ollama.apiKey,
                  signal,
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
          const config = await getAiConfig();
          
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

          const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
          const content =
            config.provider === "openai"
              ? await openaiGenerate(prompt, {
                  model: config.openai.model,
                  baseUrl: config.openai.baseUrl,
                  apiKey: config.openai.apiKey,
                  signal,
                })
              : await ollamaGenerate(prompt, {
                  model: config.ollama.model,
                  url: config.ollama.url,
                  apiKey: config.ollama.apiKey,
                  format: "json",
                  signal,
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
