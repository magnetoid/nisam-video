import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { aiSettings, aiModels } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { fetchRemoteOllamaModels, testOllamaConnection } from "../services/ollama.js";
import { testOpenAIConnection } from "../services/openai.js";
import { z } from "zod";

const router = Router();

// Get AI configuration
router.get("/config", requireAdmin, async (req, res) => {
  try {
    const settings = await db.select().from(aiSettings).limit(1);
    const config = settings[0] || {
      provider: "ollama",
      ollamaUrl: "http://localhost:11434",
    };
    
    // Mask API key if present (legacy)
    if (config.openaiApiKey) {
      config.openaiApiKey = "********";
    } else if (process.env.OPENAI_API_KEY) {
      config.openaiApiKey = "********"; // Show as configured if present in env
    }
    
    if (config.ollamaApiKey) {
      config.ollamaApiKey = "********";
    }

    if (config.openrouterApiKey) {
      config.openrouterApiKey = "********";
    }
    
    res.json(config);
  } catch (error: any) {
    // Return default config if table doesn't exist
    if (error?.code === '42P01') {
      console.warn("AI Settings table missing, returning default config");
      return res.json({
        provider: "ollama",
        ollamaUrl: "http://localhost:11434",
      });
    }
    console.error("Get AI config error:", error);
    res.status(500).json({ error: "Failed to fetch AI configuration" });
  }
});

// Update AI configuration
router.patch("/config", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      provider: z.enum(["openai", "ollama", "openrouter"]).optional(),
      openaiApiKey: z.string().optional(),
      openaiBaseUrl: z.string().optional(),
      openaiModel: z.string().optional(),
      ollamaUrl: z.string().optional(),
      ollamaModel: z.string().optional(),
      ollamaApiKey: z.string().optional(),
      openrouterApiKey: z.string().optional(),
      openrouterModel: z.string().optional(),
    });
    
    const data = schema.parse(req.body);
    
    // Don't save masked key
    if (data.openaiApiKey === "********") {
      delete data.openaiApiKey;
    }
    if (data.ollamaApiKey === "********") {
      delete data.ollamaApiKey;
    }
    if (data.openrouterApiKey === "********") {
      delete data.openrouterApiKey;
    }
    
    const existing = await db.select().from(aiSettings).limit(1);
    
    if (existing.length > 0) {
      await db.update(aiSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(aiSettings.id, existing[0].id));
    } else {
      await db.insert(aiSettings).values({
        ...data,
        updatedAt: new Date(),
      });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === '42P01') {
       return res.status(500).json({ error: "Database not initialized. Please run migrations." });
    }
    console.error("Update AI config error:", error);
    res.status(500).json({ error: "Failed to update AI configuration" });
  }
});

// List AI models
router.get("/models", requireAdmin, async (req, res) => {
  try {
    const models = await db.select().from(aiModels).orderBy(desc(aiModels.lastSyncedAt));
    res.json(models);
  } catch (error: any) {
    // Return empty list if table doesn't exist
    if (error?.code === '42P01') {
      console.warn("AI Models table missing, returning empty list");
      return res.json([]);
    }
    console.error("Get AI models error:", error);
    res.status(500).json({ error: "Failed to fetch AI models" });
  }
});

// Sync Ollama models
router.post("/ollama/sync", requireAdmin, async (req, res) => {
  try {
    // Get URL from config or body
    let url = req.body.url;
    let apiKey = req.body.apiKey;
    
    if (!url) {
      try {
        const settings = await db.select().from(aiSettings).limit(1);
        url = settings[0]?.ollamaUrl || "http://localhost:11434";
        if (!apiKey) {
          apiKey = settings[0]?.ollamaApiKey;
        }
      } catch (e: any) {
        if (e?.code === '42P01') {
           return res.status(500).json({ error: "Database not initialized. Please run migrations." });
        }
        throw e;
      }
    }
    
    const models = await fetchRemoteOllamaModels(url, apiKey);
    
    // Update DB
    const now = new Date();
    
    for (const model of models) {
      // Upsert
      try {
        await db.insert(aiModels)
          .values({
            provider: "ollama",
            name: model.name,
            size: String(model.size),
            digest: model.digest,
            family: model.details?.family,
            format: model.details?.format,
            parameterSize: model.details?.parameter_size,
            quantizationLevel: model.details?.quantization_level,
            lastSyncedAt: now,
            isActive: true, // Default to true
          })
          .onConflictDoUpdate({
            target: [aiModels.provider, aiModels.name],
            set: {
              size: String(model.size),
              digest: model.digest,
              family: model.details?.family,
              format: model.details?.format,
              parameterSize: model.details?.parameter_size,
              quantizationLevel: model.details?.quantization_level,
              lastSyncedAt: now,
            }
          });
      } catch (e: any) {
         if (e?.code === '42P01') {
           return res.status(500).json({ error: "Database not initialized. Please run migrations first." });
         }
         throw e;
      }
    }
    
    res.json({ success: true, count: models.length });
  } catch (error: any) {
    console.error("Sync Ollama models error:", error);
    res.status(500).json({ error: error.message || "Failed to sync models" });
  }
});

// Toggle model status
router.patch("/models/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    await db.update(aiModels)
      .set({ isActive })
      .where(eq(aiModels.id, id));
      
    res.json({ success: true });
  } catch (error) {
    console.error("Toggle model error:", error);
    res.status(500).json({ error: "Failed to toggle model" });
  }
});

// Test connection
router.post("/test", requireAdmin, async (req, res) => {
  try {
    let { provider, url, apiKey } = req.body;
    
    // If testing an existing configuration where the key is masked on frontend
    if (!apiKey) {
      try {
        const settings = await db.select().from(aiSettings).limit(1);
        if (settings.length > 0) {
          if (provider === "ollama") {
            apiKey = settings[0].ollamaApiKey || undefined;
            if (!url) url = settings[0].ollamaUrl || "http://localhost:11434";
          } else if (provider === "openrouter") {
            apiKey = settings[0].openrouterApiKey || undefined;
          } else {
            apiKey = settings[0].openaiApiKey || undefined;
            if (!url) url = settings[0].openaiBaseUrl || undefined;
          }
        }
      } catch (e: any) {
        if (e?.code !== '42P01') {
          console.error("Error fetching AI settings for test:", e);
        }
      }
    }
    
    if (provider === "ollama") {
      if (!url) url = "http://localhost:11434";
      const success = await testOllamaConnection(url, apiKey);
      return res.json({ success });
    }

    if (provider === "openrouter") {
      if (!apiKey) {
        return res.status(400).json({ success: false, error: "OpenRouter API key is required" });
      }
      // Test OpenRouter by making a lightweight request
      const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        }
      });
      return res.json({ success: response.ok });
    }
    
    if (!apiKey) {
      // Also fallback to process.env.OPENAI_API_KEY if not in DB
      if (process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
      } else {
        return res.status(400).json({ success: false, error: "OpenAI API key is required" });
      }
    }
    const baseUrl = typeof url === "string" && url.trim() ? url.trim() : "https://api.openai.com/v1";
    const success = await testOpenAIConnection(baseUrl, apiKey);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
