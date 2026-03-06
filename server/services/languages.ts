import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "../storage/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_PATH = path.resolve(__dirname, "../../client/src/i18n/locales");

/**
 * Helper to check if item is an object
 */
function isObject(item: any) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects
 */
export function mergeDeep(target: any, source: any) {
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return target;
}

/**
 * Flatten a nested object into dot notation keys
 */
export function flattenObject(obj: any, prefix = '', res: Record<string, string> = {}) {
  for (const key in obj) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object') {
      flattenObject(val, newKey, res);
    } else {
      res[newKey] = String(val);
    }
  }
  return res;
}

/**
 * Load file-based translations
 */
export async function loadFileTranslations(lng: string): Promise<Record<string, any>> {
  try {
    const localePath = path.join(LOCALES_PATH, `${lng}.json`);
    const content = await fs.readFile(localePath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return {};
  }
}

/**
 * Get merged translations (File + DB) in nested format
 * Used by i18next-http-backend
 */
export async function getMergedTranslations(lng: string, ns: string = 'translation'): Promise<Record<string, any>> {
  // 1. Load file-based translation
  const fileData = await loadFileTranslations(lng);

  // 2. Load DB overrides (flat)
  const dbDataFlat = await storage.getUiTranslations(lng, ns);

  // 3. Unflatten DB keys
  const dbDataNested: Record<string, any> = {};
  for (const [key, value] of Object.entries(dbDataFlat)) {
    const parts = key.split('.');
    let current = dbDataNested;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = value;
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  // 4. Merge (DB wins)
  return mergeDeep(fileData, dbDataNested);
}

/**
 * Get all translations in flat format
 * Used by Admin UI and Auto-Translate
 */
export async function getAllTranslationsFlat(lng: string): Promise<Record<string, string>> {
  const fileData = await loadFileTranslations(lng);
  const flatFile = flattenObject(fileData);
  const dbData = await storage.getUiTranslations(lng, 'translation');
  return { ...flatFile, ...dbData };
}
