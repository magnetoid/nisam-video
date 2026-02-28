
import "dotenv/config";
import { pool } from "./server/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function apply() {
  const sqlFile = path.join(__dirname, "migrations", "fix_schema_manual.sql");
  console.log(`Applying migration from ${sqlFile}...`);
  
  if (!fs.existsSync(sqlFile)) {
    console.error("Migration file not found!");
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFile, "utf-8");
  
  if (!pool) {
      console.error("Pool not initialized");
      process.exit(1);
  }

  try {
    await pool.query(sqlContent);
    console.log("Migration applied successfully!");
  } catch (e: any) {
    console.error("Migration failed:", e);
    if (e.message.includes("already exists")) {
        console.log("Ignored 'already exists' error.");
    }
  }
  process.exit(0);
}

apply();
