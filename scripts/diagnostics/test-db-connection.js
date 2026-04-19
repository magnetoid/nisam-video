// Test database connection
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    if (!pool) {
      console.log('❌ Database pool is not initialized');
      return;
    }
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful!');
    console.log('Current time:', result.rows[0].current_time);
    
    // Test system settings table
    try {
      const settingsResult = await client.query('SELECT * FROM system_settings LIMIT 1');
      console.log('System settings found:', settingsResult.rows.length);
      if (settingsResult.rows.length > 0) {
        console.log('Settings:', settingsResult.rows[0]);
      } else {
        console.log('ℹ️  No system settings found, table exists but empty');
      }
    } catch (tableError) {
      console.log('⚠️  System settings table not found:', tableError.message);
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testConnection();