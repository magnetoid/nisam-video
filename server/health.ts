import { pool } from "./db.js";
import { getRedisClient } from "./services/redis.js";

type DependencyState = {
  configured: boolean;
  ok: boolean;
  status?: string;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError?: string;
};

type HealthSnapshot = {
  database: DependencyState;
  redis: DependencyState;
};

let snapshot: HealthSnapshot = {
  database: {
    configured: false,
    ok: true,
    lastOkAt: null,
    lastErrorAt: null,
  },
  redis: {
    configured: false,
    ok: true,
    status: "disabled",
    lastOkAt: null,
    lastErrorAt: null,
  },
};

function nowIso() {
  return new Date().toISOString();
}

async function probeDatabase() {
  const configured = Boolean(process.env.DATABASE_URL);
  snapshot.database.configured = configured;
  if (!configured || !pool) {
    snapshot.database.ok = false;
    snapshot.database.lastErrorAt = snapshot.database.lastErrorAt || nowIso();
    snapshot.database.lastError = configured ? "DB pool not initialized" : "DATABASE_URL not set";
    return;
  }

  try {
    await pool.query("select 1 as ok");
    snapshot.database.ok = true;
    snapshot.database.lastOkAt = nowIso();
    snapshot.database.lastErrorAt = null;
    snapshot.database.lastError = undefined;
  } catch (err: any) {
    snapshot.database.ok = false;
    snapshot.database.lastErrorAt = nowIso();
    snapshot.database.lastError = err?.message ? String(err.message) : String(err);
  }
}

async function probeRedis() {
  const configured = Boolean(process.env.REDIS_URL);
  snapshot.redis.configured = configured;

  const redis = getRedisClient();
  snapshot.redis.status = redis?.status || (configured ? "initializing" : "disabled");

  if (!configured) {
    snapshot.redis.ok = true;
    snapshot.redis.lastErrorAt = null;
    snapshot.redis.lastError = undefined;
    return;
  }

  if (!redis) {
    snapshot.redis.ok = false;
    snapshot.redis.lastErrorAt = nowIso();
    snapshot.redis.lastError = "Redis client not initialized";
    return;
  }

  try {
    await redis.ping();
    snapshot.redis.ok = true;
    snapshot.redis.lastOkAt = nowIso();
    snapshot.redis.lastErrorAt = null;
    snapshot.redis.lastError = undefined;
  } catch (err: any) {
    snapshot.redis.ok = false;
    snapshot.redis.lastErrorAt = nowIso();
    snapshot.redis.lastError = err?.message ? String(err.message) : String(err);
  }
}

export function startHealthProbes() {
  const intervalMs = Math.max(1000, Math.min(60_000, parseInt(process.env.HEALTH_PROBE_INTERVAL_MS || "10000", 10) || 10_000));

  const run = async () => {
    await Promise.allSettled([probeDatabase(), probeRedis()]);
  };

  void run();
  setInterval(() => {
    void run();
  }, intervalMs);
}

export function getHealthSnapshot(): HealthSnapshot {
  return snapshot;
}

