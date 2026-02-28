
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Migrating hero_settings...");
  try {
    await db.execute(sql`
      ALTER TABLE hero_settings 
      ADD COLUMN IF NOT EXISTS home_hero_mode text DEFAULT 'primary',
      ADD COLUMN IF NOT EXISTS popular_page_mode text DEFAULT 'views';
    `);
    console.log("Migration successful");
  } catch (e) {
    console.error("Migration failed:", e);
  }
  process.exit(0);
}

main();
