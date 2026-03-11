import fs from "fs/promises";
import path from "path";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "client", "src", "i18n", "locales");
const destDir = path.join(projectRoot, "dist", "locales");

async function pathExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await pathExists(sourceDir))) {
    console.log(`[i18n] locales source missing: ${sourceDir}`);
    return;
  }

  await fs.mkdir(destDir, { recursive: true });
  const files = await fs.readdir(sourceDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  await Promise.all(
    jsonFiles.map(async (file) => {
      await fs.copyFile(path.join(sourceDir, file), path.join(destDir, file));
    }),
  );
  console.log(`[i18n] copied ${jsonFiles.length} locale files to ${destDir}`);
}

main().catch((err) => {
  console.error("[i18n] copy-locales failed", err);
  process.exitCode = 1;
});

