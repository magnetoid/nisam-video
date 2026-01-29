import { pool } from "./server/db";

async function checkTables() {
  if (!pool) {
    console.error("No database pool available");
    return;
  }

  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("Tables in database:");
    res.rows.forEach(row => console.log(`- ${row.table_name}`));
    
    const sessionTable = res.rows.find(row => row.table_name === 'session');
    if (sessionTable) {
        console.log("\nSession table exists.");
    } else {
        console.error("\nSession table MISSING!");
    }

  } catch (err) {
    console.error("Error querying database:", err);
  } finally {
    await pool.end();
  }
}

checkTables();
