// Reference: javascript_database blueprint
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon serverless
// Always use ws package for WebSocket connections in Node.js environment
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = "password";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool for Cloudflare edge compatibility
// Cloudflare has strict connection limits
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // Cloudflare edge: use minimal connections (1 per worker)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const db = drizzle({ client: pool, schema });
