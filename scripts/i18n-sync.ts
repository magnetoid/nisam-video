import fs from "fs/promises";
import path from "path";

type AnyObject = Record<string, any>;

function isObject(value: unknown): value is AnyObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function humanizeKey(key: string): string {
  const last = key.split(".").filter(Boolean).pop() || key;
  const spaced = last
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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

function getDeep(target: AnyObject, dottedKey: string): unknown {
  const parts = dottedKey.split(".").filter(Boolean);
  let current: any = target;
  for (const part of parts) {
    if (!isObject(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
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

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

type FoundKey = {
  key: string;
  defaultValue?: string;
};

function extractKeys(source: string): FoundKey[] {
  const found: FoundKey[] = [];

  const tWithStringDefault =
    /\bt\(\s*(['"])([^'"\n]+)\1\s*,\s*(['"])([\s\S]*?)\3\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = tWithStringDefault.exec(source))) {
    const key = m[2].trim();
    const value = m[4];
    if (key) found.push({ key, defaultValue: value });
  }

  const tWithObjectDefault =
    /\bt\(\s*(['"])([^'"\n]+)\1\s*,\s*\{[\s\S]*?\bdefaultValue\s*:\s*(['"])([\s\S]*?)\3[\s\S]*?\}\s*\)/g;
  while ((m = tWithObjectDefault.exec(source))) {
    const key = m[2].trim();
    const value = m[4];
    if (key) found.push({ key, defaultValue: value });
  }

  const tKeyOnly = /\bt\(\s*(['"])([^'"\n]+)\1\s*\)/g;
  while ((m = tKeyOnly.exec(source))) {
    const key = m[2].trim();
    if (key) found.push({ key });
  }

  return found;
}

async function main() {
  const repoRoot = path.resolve(process.cwd());
  const clientRoot = path.join(repoRoot, "client", "src");
  const enPath = path.join(clientRoot, "i18n", "locales", "en.json");

  const en: AnyObject = JSON.parse(await fs.readFile(enPath, "utf8"));

  const files = await walk(clientRoot);
  const discovered = new Map<string, { defaultValue?: string }>();

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const keys = extractKeys(text);
    for (const entry of keys) {
      if (!discovered.has(entry.key)) {
        discovered.set(entry.key, { defaultValue: entry.defaultValue });
        continue;
      }
      const existing = discovered.get(entry.key);
      if (!existing?.defaultValue && entry.defaultValue) {
        discovered.set(entry.key, { defaultValue: entry.defaultValue });
      }
    }
  }

  let added = 0;
  let updated = 0;

  for (const [key, meta] of discovered.entries()) {
    const existingValue = getDeep(en, key);
    const desired = meta.defaultValue ?? humanizeKey(key);
    if (existingValue === undefined) {
      setDeep(en, key, desired);
      added++;
    } else if (typeof existingValue === "string") {
      if (existingValue.trim() === "" || existingValue === key) {
        setDeep(en, key, desired);
        updated++;
      }
    }
  }

  const sorted = sortDeep(en);
  await fs.writeFile(enPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");

  console.log(`[i18n-sync] scanned files: ${files.length}`);
  console.log(`[i18n-sync] discovered keys: ${discovered.size}`);
  console.log(`[i18n-sync] en.json added: ${added}, updated: ${updated}`);
}

await main();

