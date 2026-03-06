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

  if (!config) {
    throw new Error("AI not configured. Please configure AI settings in the admin panel.");
  }

  // 2. Construct Prompt
  const systemPrompt = `You are a professional translator for a video platform application. 
Translate the provided JSON content from ${sourceLang} to ${targetLang}.
Preserve all keys exactly.
Preserve any interpolation variables like {{count}}, {{name}}, etc.
Return ONLY valid JSON.`;

  const userPrompt = JSON.stringify(content, null, 2);

  let rawResponse = "";

  // 3. Call Provider
  if (config.provider === "ollama") {
    if (!config.ollamaModel) throw new Error("Ollama model not selected.");
    
    rawResponse = await generateOllamaCompletion(
      config.ollamaUrl || "http://localhost:11434",
      config.ollamaModel,
      systemPrompt,
      userPrompt,
      config.ollamaApiKey || undefined
    );
  } else {
    // OpenAI
    if (!config.openaiApiKey) throw new Error("OpenAI API key not configured.");
    
    rawResponse = await generateOpenAICompletion(
      config.openaiBaseUrl || "https://api.openai.com/v1",
      config.openaiApiKey,
      config.openaiModel || "gpt-3.5-turbo",
      systemPrompt,
      userPrompt
    );
  }

  // 4. Parse Response
  try {
    // Clean up potential markdown blocks if AI adds them (e.g. ```json ... ```)
    const jsonStr = rawResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI translation response:", rawResponse);
    throw new Error("AI returned invalid JSON.");
  }
}
