import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { scanUrl, proposeTools, enhanceWithLlm, exportTools } from "@keak/webmcp-core";
import { db, isDbReady } from "../server/db.js";
import { aiSettings } from "../shared/schema.js";

function getArgValue(flag: string) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function parseNumber(value: string | undefined, fallback: number) {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

async function getOpenAiKeyFromDb() {
  if (!isDbReady()) return undefined;
  const rows = await db.select().from(aiSettings).limit(1);
  const row = rows?.[0] as any;
  const provider = row?.provider;
  const key = row?.openaiApiKey || row?.openai_api_key;
  if (provider !== "openai") return undefined;
  if (typeof key !== "string") return undefined;
  if (!key.trim() || key.trim() === "********") return undefined;
  return key.trim();
}

async function main() {
  const url = getArgValue("--url") || process.argv.find((a) => a.startsWith("http"));
  if (!url) {
    throw new Error("Usage: npm run webmcp:generate -- --url https://example.com");
  }

  const depth = parseNumber(getArgValue("--depth"), 2);
  const timeout = parseNumber(getArgValue("--timeout"), 60000);
  const cookie = getArgValue("--cookie");
  const minConfidence = parseNumber(getArgValue("--min-confidence"), 0.5);
  const format = (getArgValue("--format") || "snippet") as any;
  const outFile =
    getArgValue("--out") || resolve(process.cwd(), ".webmcp/webmcp.tools.ts");

  const scan = await scanUrl({ url, depth, timeout, headless: true, cookie });
  const tools = proposeTools(scan, { minConfidence });

  const openAiKey = await getOpenAiKeyFromDb();
  const enriched = openAiKey
    ? await enhanceWithLlm(tools, scan.actions, { apiKey: openAiKey })
    : tools;

  const output = exportTools(enriched, format, { domain: new URL(url).hostname });
  const content =
    output.files && output.files.length > 0
      ? output.files.map((f) => f.content).join("\n")
      : "";

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, content, "utf8");

  process.stdout.write(`${outFile}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
