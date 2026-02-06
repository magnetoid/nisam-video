import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

export const dbUrl = process.env.DATABASE_URL;

export let pool: Pool | null = null;
export let db: ReturnType<typeof drizzle> | any = null;

if (dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }, // Allow self-signed certs (Supabase pooler)
    max: process.env.NODE_ENV === "production" ? 1 : 10, // Use single connection per lambda in production
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // Reduced from 10s to fail faster
  });

  // Prevent crashes on idle client errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // process.exit(-1); // Do not exit, let it recover
  });

  db = drizzle(pool, { schema });
} else {
  console.warn("DATABASE_URL is not set. Running in in-memory mode. Database features will be simulated.");
  
  // Mock DB implementation to prevent crashes in routes that use db directly
  const mockDb = {
      select: () => {
          const chain: any = {
              from: () => chain,
              where: () => chain,
              limit: () => chain,
              orderBy: () => chain,
              innerJoin: () => chain,
              leftJoin: () => chain,
              offset: () => chain,
              then: (resolve: Function) => resolve([]) // Return empty array
          };
          return chain;
      },
      insert: (table: any) => {
          return {
              values: (data: any) => {
                  return {
                      returning: () => Promise.resolve([data]),
                      onConflictDoNothing: () => Promise.resolve(),
                      then: (resolve: Function) => resolve({ rowCount: 1 })
                  };
              }
          };
      },
      update: (table: any) => {
          return {
              set: (data: any) => {
                  return {
                      where: () => {
                          return {
                              returning: () => Promise.resolve([data]),
                              then: (resolve: Function) => resolve({ rowCount: 1 })
                          };
                      }
                  };
              }
          };
      },
      delete: (table: any) => {
          return {
              where: () => Promise.resolve({ rowCount: 1 })
          };
      },
      execute: (query: any) => {
          return Promise.resolve({ rows: [] });
      }
  };
  db = mockDb;
}

export function isDbReady() {
  return !!pool && !!db;
}
