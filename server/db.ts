// Reference: javascript_database blueprint
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema.js";

// Configure WebSocket for Neon serverless
// Always use ws package for WebSocket connections in Node.js environment
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = "password";

export const dbUrl = process.env.DATABASE_URL;

// Configure connection pool for Cloudflare edge compatibility
// Cloudflare has strict connection limits
export let pool: Pool | null = null;
export let db: ReturnType<typeof drizzle> | any = null;

if (dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    max: 1, // Cloudflare edge: use minimal connections (1 per worker)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  db = drizzle({ client: pool, schema });
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
      }
  };
  db = mockDb;
}
