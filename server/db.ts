import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";
import { recordError } from "./error-log-service.js";

export const dbUrl = process.env.DATABASE_URL;

function parseBoolEnv(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return defaultValue;
}

export let pool: Pool | null = null;
export let db: ReturnType<typeof drizzle> | any = null;
let activeConnectionString: string | null = null;
let activeSslEnabled: boolean | null = null;
let activeLabel: string = process.env.DB_ACTIVE_LABEL || "primary";

function maskConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "(invalid)";
  }
}

function createPoolAndDb(connectionString: string, sslEnabled: boolean) {
  const newPool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : (process.env.NODE_ENV === "production" ? 10 : 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  newPool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
    recordError({
      level: "critical",
      type: "db_pool_error",
      message: err.message,
      stack: err.stack,
      module: "db",
    });
  });

  const newDb = drizzle(newPool, { schema });
  return { newPool, newDb };
}

export async function switchDatabaseConnection(params: {
  label: string;
  connectionString: string;
  sslEnabled: boolean;
}) {
  const prev = {
    label: activeLabel,
    connectionString: activeConnectionString,
    sslEnabled: activeSslEnabled,
  };

  const { newPool, newDb } = createPoolAndDb(params.connectionString, params.sslEnabled);

  const oldPool = pool;
  pool = newPool;
  db = newDb;
  activeLabel = params.label;
  activeConnectionString = params.connectionString;
  activeSslEnabled = params.sslEnabled;

  try {
    await newPool.query("select 1 as ok");
  } catch (e) {
    pool = oldPool;
    db = oldPool ? drizzle(oldPool, { schema }) : null;
    activeLabel = prev.label;
    activeConnectionString = prev.connectionString;
    activeSslEnabled = prev.sslEnabled;
    try {
      await newPool.end();
    } catch {}
    throw e;
  }

  try {
    if (oldPool) await oldPool.end();
  } catch {}

  return prev;
}

export function getActiveDatabaseInfo() {
  return {
    label: activeLabel,
    configured: Boolean(activeConnectionString || dbUrl),
    maskedUrl: activeConnectionString ? maskConnectionString(activeConnectionString) : dbUrl ? maskConnectionString(dbUrl) : null,
    sslEnabled: activeSslEnabled,
  };
}

if (dbUrl) {
  let connectionString = dbUrl;
  try {
    const url = new URL(dbUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    connectionString = url.toString();
  } catch {}

  try {
    const sslEnabled = parseBoolEnv(process.env.DB_SSL, true);
    const created = createPoolAndDb(connectionString, sslEnabled);
    pool = created.newPool;
    db = created.newDb;
    activeConnectionString = connectionString;
    activeSslEnabled = sslEnabled;
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
