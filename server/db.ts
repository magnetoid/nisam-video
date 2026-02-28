import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";
import { recordError } from "./error-log-service.js";

export const dbUrl = process.env.DATABASE_URL;

export let pool: Pool | null = null;
export let db: ReturnType<typeof drizzle> | any = null;

if (dbUrl) {
  let connectionString = dbUrl;
  try {
    const url = new URL(dbUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    connectionString = url.toString();
  } catch {}

  try {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // Allow self-signed certs (Supabase pooler)
      // Use env var for max connections, default to 10. 
      // Only use 1 if specifically needed for serverless environments without pooling.
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : (process.env.NODE_ENV === "production" ? 10 : 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased to 10s to allow more time for connection acquisition
    });

    // Prevent crashes on idle client errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      recordError({
        level: "critical",
        type: "db_pool_error",
        message: err.message,
        stack: err.stack,
        module: "db",
      });
      // process.exit(-1); // Do not exit, let it recover
    });

    db = drizzle(pool, { schema });
  } catch (error) {
    console.error("Failed to initialize database connection:", error);
    recordError({
      level: "critical",
      type: "db_connection_error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      module: "db",
    });
  }
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
