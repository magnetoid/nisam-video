import "dotenv/config";
import { pool } from "./server/db.js";
import fs from "fs";
import path from "path";

async function apply() {
  const sqlFile = path.join(process.cwd(), "migrations", "0006_fix_schema_sync.sql");
  const sqlContent = fs.readFileSync(sqlFile, "utf-8");
  
  console.log("Applying migration 0006...");
  
  if (!pool) {
      console.error("Pool not initialized");
      process.exit(1);
  }

  try {
    await pool.query(sqlContent);
    console.log("Migration applied successfully!");
  } catch (e: any) {
    console.error("Migration failed:", e.message);
  }
  process.exit(0);
}
apply();
