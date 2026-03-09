import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../server/db.js";
import { aiSettings } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { translateContent } from "../server/services/translation-service.js";

type AnyObject = Record<string, any>;

function isObject(value: unknown): value is AnyObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function flatten(obj: AnyObject, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

function setDeep(target: AnyObject, dottedKey: string, value: string) {
  const parts = dottedKey.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let current: AnyObject = target;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === parts.length - 1) {
      current[part] = value;
      return;
    }
    if (!isObject(current[part])) current[part] = {};
    current = current[part];
  }
}

function sortDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortDeep);
  if (!isObject(obj)) return obj;
  const out: AnyObject = {};
  for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
    out[key] = sortDeep(obj[key]);
  }
  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function ensureOpenAISettingsFromEnv() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  const existing = await db.select().from(aiSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(aiSettings).values({
      provider: "openai",
      openaiApiKey: apiKey,
      openaiBaseUrl: "https://api.openai.com/v1",
      openaiModel: "gpt-3.5-turbo",
      updatedAt: new Date(),
    });
    return;
  }

  const row = existing[0];
  if (row.provider !== "openai" || !row.openaiApiKey) {
    await db
      .update(aiSettings)
      .set({
        provider: "openai",
        openaiApiKey: row.openaiApiKey || apiKey,
        openaiBaseUrl: row.openaiBaseUrl || "https://api.openai.com/v1",
        openaiModel: row.openaiModel || "gpt-3.5-turbo",
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.id, row.id));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetIdx = args.findIndex((a) => a === "--target");
  const targetLang = targetIdx >= 0 ? args[targetIdx + 1] : "sr-Latn";
  const batchSizeIdx = args.findIndex((a) => a === "--batch");
  const batchSize = batchSizeIdx >= 0 ? parseInt(args[batchSizeIdx + 1] || "50", 10) : 50;

  if (!targetLang) {
    throw new Error("Missing --target <lang>");
  }

  await ensureOpenAISettingsFromEnv();

  const repoRoot = path.resolve(process.cwd());
  const localesDir = path.join(repoRoot, "client", "src", "i18n", "locales");
  const enPath = path.join(localesDir, "en.json");
  const targetPath = path.join(localesDir, `${targetLang}.json`);

  const en = JSON.parse(await fs.readFile(enPath, "utf8")) as AnyObject;
  const target = JSON.parse(await fs.readFile(targetPath, "utf8")) as AnyObject;

  const enFlat = flatten(en);
  const targetFlat = flatten(target);

  const missingKeys = Object.keys(enFlat)
    .filter((k) => !(k in targetFlat) || String(targetFlat[k] ?? "").trim() === "")
    .sort((a, b) => a.localeCompare(b));

  if (missingKeys.length === 0) {
    console.log(`[i18n-translate] ${targetLang}: nothing to translate`);
    return;
  }

  console.log(`[i18n-translate] ${targetLang}: missing ${missingKeys.length} keys (batch ${batchSize})`);

  const batches = chunk(missingKeys, batchSize);
  let done = 0;

  for (let i = 0; i < batches.length; i++) {
    const keys = batches[i];
    const payload: Record<string, string> = {};
    for (const k of keys) payload[k] = enFlat[k];

    const translated = await translateContent(targetLang, payload, "en");
    for (const [k, v] of Object.entries(translated)) {
      setDeep(target, k, String(v));
    }
    done += keys.length;
    console.log(`[i18n-translate] ${targetLang}: ${done}/${missingKeys.length}`);
  }

  const sorted = sortDeep(target);
  await fs.writeFile(targetPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  console.log(`[i18n-translate] ${targetLang}: wrote ${targetPath}`);
}

await main();

