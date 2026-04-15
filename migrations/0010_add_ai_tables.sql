
CREATE TABLE IF NOT EXISTS "ai_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text DEFAULT 'openai' NOT NULL,
  "openai_api_key" text,
  "openai_base_url" text,
  "openai_model" text DEFAULT 'gpt-5',
  "ollama_url" text DEFAULT 'http://localhost:11434',
  "ollama_model" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_models" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL,
  "name" text NOT NULL,
  "size" varchar,
  "digest" text,
  "family" text,
  "format" text,
  "parameter_size" text,
  "quantization_level" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_synced_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ai_models_provider_name_unique" UNIQUE("provider", "name")
);
