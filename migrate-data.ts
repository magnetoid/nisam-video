import { Pool } from 'pg';
import 'dotenv/config';

// Migration script to copy data from old Coolify Postgres to new Compose Postgres
// Only run this once!

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error('Missing SOURCE_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

const sourcePool = new Pool({
  connectionString: SOURCE_URL,
  ssl: { rejectUnauthorized: false }
});

const targetPool = new Pool({
  connectionString: TARGET_URL,
  ssl: false
});

// Tables to migrate in order of dependencies
const TABLES = [
  'channels',
  'categories',
  'videos',
  'tags',
  'video_tags',
  'scrape_jobs',
  'scrape_job_logs',
  'error_bookmarks',
  'seo_settings',
  'seo_redirects',
  'seo_meta_tags',
  'seo_keywords',
  'seo_ab_tests',
  'seo_competitors',
  'seo_audit_logs'
];

async function migrateTable(tableName: string) {
  console.log(`\nMigrating table: ${tableName}...`);
  const clientSource = await sourcePool.connect();
  const clientTarget = await targetPool.connect();

  try {
    // Check if table exists in source
    const checkSource = await clientSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      );
    `, [tableName]);

    if (!checkSource.rows[0].exists) {
      console.log(`Table ${tableName} does not exist in source database. Skipping.`);
      return;
    }

    // Get all data from source
    const result = await clientSource.query(`SELECT * FROM ${tableName}`);
    const rows = result.rows;
    
    if (rows.length === 0) {
      console.log(`Table ${tableName} is empty. Skipping.`);
      return;
    }

    console.log(`Found ${rows.length} rows in ${tableName}.`);

    // Disable foreign key checks temporarily on target
    await clientTarget.query(`SET session_replication_role = 'replica';`);

    // Clear target table
    await clientTarget.query(`TRUNCATE TABLE ${tableName} CASCADE`);

    // Get column names
    const columns = Object.keys(rows[0]);
    const columnList = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const insertQuery = `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`;

    // Insert rows
    let count = 0;
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      await clientTarget.query(insertQuery, values);
      count++;
      if (count % 100 === 0) console.log(`  Inserted ${count}/${rows.length} rows...`);
    }

    // Re-enable foreign key checks
    await clientTarget.query(`SET session_replication_role = 'origin';`);

    // Update sequence if table has an ID column that is an integer
    if (columns.includes('id') && typeof rows[0].id === 'number') {
      try {
        await clientTarget.query(`
          SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM "${tableName}";
        `);
        console.log(`Updated sequence for ${tableName}.`);
      } catch (e) {
        // Ignore sequence update errors for tables without serial IDs
      }
    }

    console.log(`✅ Successfully migrated ${rows.length} rows for ${tableName}`);
  } catch (error) {
    console.error(`❌ Error migrating table ${tableName}:`, error);
  } finally {
    clientSource.release();
    clientTarget.release();
  }
}

async function run() {
  console.log('Starting database migration...');
  console.log(`Source: ${SOURCE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Target: ${TARGET_URL.replace(/:[^:@]+@/, ':***@')}`);

  try {
    for (const table of TABLES) {
      await migrateTable(table);
    }
    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

run();
