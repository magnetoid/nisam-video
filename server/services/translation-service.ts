import { db } from "../db.js";
import { aiSettings } from "../../shared/schema.js";
import { generateOllamaCompletion } from "./ollama.js";
import { generateOpenAICompletion } from "./openai.js";

export async function translateContent(
  targetLang: string,
  content: Record<string, string>,
  sourceLang: string = "en"
): Promise<Record<string, string>> {
  if (Object.keys(content).length === 0) return {};

  // 1. Get AI Settings
  const settings = await db.select().from(aiSettings).limit(1);
  const config = settings[0];

  const envOpenAIKey = process.env.OPENAI_API_KEY;
  const envOpenAIBaseUrl = process.env.OPENAI_BASE_URL;
  const envOpenAIModel = process.env.OPENAI_MODEL;

  if (!config) {
    if (!envOpenAIKey) {
      throw new Error("AI not configured. Please configure AI settings in the admin panel.");
    }
  }

  // 2. Construct Prompt
  const systemPrompt = `You are a professional translator for a video streaming platform application (similar to YouTube/Netflix). 
Translate the provided JSON content from ${sourceLang} to ${targetLang}.

Rules:
1. Preserve all keys exactly.
2. Preserve any interpolation variables like {{count}}, {{name}}, {{val}}, etc.
3. Do not translate technical terms if they are standard in the target language (e.g. "API", "SEO", "JSON").
4. Keep UI strings concise and natural for buttons/labels.
5. Return ONLY valid JSON. No markdown formatting, no explanations.`;

  const userPrompt = JSON.stringify(content, null, 2);

  let rawResponse = "";

  // 3. Call Provider
  const effectiveProvider =
    config?.provider === "ollama" && !config?.ollamaModel && envOpenAIKey
      ? "openai"
      : (config?.provider || (envOpenAIKey ? "openai" : "ollama"));

  const tryOpenAI = async () => {
    const apiKey = config?.openaiApiKey || envOpenAIKey;
    if (!apiKey) throw new Error("OpenAI API key not configured.");
    return await generateOpenAICompletion(
      config?.openaiBaseUrl || envOpenAIBaseUrl || "https://api.openai.com/v1",
      apiKey,
      config?.openaiModel || envOpenAIModel || "gpt-3.5-turbo",
      systemPrompt,
      userPrompt,
    );
  };

  if (effectiveProvider === "ollama") {
    if (!config?.ollamaModel) throw new Error("Ollama model not selected.");

    try {
      rawResponse = await generateOllamaCompletion(
        config?.ollamaUrl || "http://localhost:11434",
        config.ollamaModel,
        systemPrompt,
        userPrompt,
        config?.ollamaApiKey || undefined,
      );
    } catch (error: any) {
      const canFallbackToOpenAI = Boolean(config?.openaiApiKey || envOpenAIKey);
      if (!canFallbackToOpenAI) throw error;
      try {
        rawResponse = await tryOpenAI();
      } catch (openAiError: any) {
        const ollamaMsg = error?.message || String(error);
        const openAiMsg = openAiError?.message || String(openAiError);
        throw new Error(`Ollama failed (${ollamaMsg}). OpenAI fallback also failed (${openAiMsg}).`);
      }
    }
  } else {
    rawResponse = await tryOpenAI();
  }

  // 4. Parse Response
  try {
    // Clean up potential markdown blocks if AI adds them (e.g. ```json ... ```)
    const jsonStr = rawResponse.replace(/^```json\s*/, "").replace(/^```/, "").replace(/\s*```$/, "").trim();
    // Sometimes LLMs add text before/after, try to extract first {...}
    const match = jsonStr.match(/\{[\s\S]*\}/);
    const parseTarget = match ? match[0] : jsonStr;
    
    return JSON.parse(parseTarget);
  } catch (e) {
    console.error("Failed to parse AI translation response:", rawResponse);
    throw new Error(`AI returned invalid JSON: ${rawResponse.substring(0, 100)}...`);
  }
}
