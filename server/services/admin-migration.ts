import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { switchDatabaseConnection } from "../db.js";

export type MigrationJobState = "queued" | "running" | "failed" | "succeeded";
export type MigrationJobPhase =
  | "preparing"
  | "migrating_schema"
  | "copying"
  | "validating"
  | "ready_for_cutover"
  | "cutover"
  | "done";

export type MigrationJob = {
  jobId: string;
  state: MigrationJobState;
  phase: MigrationJobPhase;
  progressPct?: number;
  counters?: Record<string, number>;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  logs: { level: "info" | "warn" | "error"; message: string; at: string }[];
};

function parseBoolEnv(value: string | undefined, defaultValue: boolean) {
  if (value == null) return defaultValue;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return defaultValue;
}

function maskConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "(invalid)";
  }
}

function getMigrationsFolder() {
  const candidates = [
    path.join(process.cwd(), "migrations"),
    path.join(process.cwd(), "../migrations"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migrations"),
    "/app/migrations",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, "meta"))) {
      return candidate;
    }
  }
  return null;
}

async function applySqlMigrations(pool: Pool, migrationsFolder: string, onLog?: (msg: string) => void) {
  const entries = fs.readdirSync(migrationsFolder, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const duplicateCodes = new Set(["42P07", "42701", "42710"]);

  for (const file of files) {
    const fullPath = path.join(migrationsFolder, file);
    const sqlText = fs.readFileSync(fullPath, "utf8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (e: any) {
        if (e?.code && duplicateCodes.has(String(e.code))) {
          onLog?.(`Skipped already-applied statement (${e.code}) from ${file}`);
          continue;
        }
        throw e;
      }
    }
  }
}

async function withPool<T>(
  connectionString: string,
  sslEnabled: boolean,
  fn: (pool: Pool) => Promise<T>,
) {
  const pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    return await fn(pool);
  } finally {
    try {
      await pool.end();
    } catch {}
  }
}

async function tableExists(pool: Pool, tableName: string) {
  const res = await pool.query(
    `select 1 as ok from information_schema.tables where table_schema='public' and table_name=$1 limit 1`,
    [tableName],
  );
  return (res.rowCount ?? 0) > 0;
}

async function listPublicTables(pool: Pool) {
  const res = await pool.query(
    `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`,
  );
  return res.rows.map((r) => String(r.table_name));
}

async function listCommonColumns(pool: Pool, tableName: string) {
  const res = await pool.query(
    `select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,
    [tableName],
  );
  return res.rows.map((r) => String(r.column_name));
}

function quoteIdent(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class AdminMigrationService {
  private jobs = new Map<string, MigrationJob>();
  private runningJobId: string | null = null;
  private lastCutoverPrev: {
    label: string;
    connectionString: string | null;
    sslEnabled: boolean | null;
  } | null = null;

  private getSourceUrl() {
    return (
      process.env.MIGRATION_SOURCE_DATABASE_URL ||
      process.env.SUPABASE_POSTGRES_URL ||
      process.env.DB_URL ||
      null
    );
  }

  private getTargetUrl() {
    return (
      process.env.MIGRATION_TARGET_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_POSTGRES_URL ||
      process.env.DB_URL ||
      null
    );
  }

  getJob(jobId: string) {
    return this.jobs.get(jobId) || null;
  }

  private log(jobId: string, level: "info" | "warn" | "error", message: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.logs.push({ level, message, at: new Date().toISOString() });
    if (job.logs.length > 800) job.logs.splice(0, job.logs.length - 800);
  }

  async preflight() {
    const migrationsFolder = getMigrationsFolder();

    const sourceUrl = this.getSourceUrl();
    const targetUrl = this.getTargetUrl();

    const sourceSslEnabled = parseBoolEnv(process.env.MIGRATION_SOURCE_DB_SSL, true);
    const targetSslEnabled = parseBoolEnv(process.env.MIGRATION_TARGET_DB_SSL, parseBoolEnv(process.env.DB_SSL, true));

    const checks: { name: string; ok: boolean; message?: string }[] = [];

    if (!sourceUrl) {
      checks.push({
        name: "source_configured",
        ok: false,
        message: "No source DB configured (set MIGRATION_SOURCE_DATABASE_URL, or SUPABASE_POSTGRES_URL, or DB_URL)",
      });
    } else {
      checks.push({ name: "source_configured", ok: true });
    }

    if (!targetUrl) {
      checks.push({
        name: "target_configured",
        ok: false,
        message: "No target DB configured (set MIGRATION_TARGET_DATABASE_URL, or DATABASE_URL, or SUPABASE_POSTGRES_URL, or DB_URL)",
      });
    } else {
      checks.push({ name: "target_configured", ok: true });
    }

    if (!migrationsFolder) {
      checks.push({ name: "migrations_present", ok: false, message: "migrations folder not found in container" });
    } else {
      checks.push({ name: "migrations_present", ok: true, message: `Using ${migrationsFolder}` });
    }

    if (sourceUrl) {
      try {
        await withPool(sourceUrl, sourceSslEnabled, async (pool) => {
          await pool.query("select 1 as ok");
          const hasVideos = await tableExists(pool, "videos");
          checks.push({
            name: "source_connectivity",
            ok: true,
            message: maskConnectionString(sourceUrl),
          });
          checks.push({
            name: "source_schema",
            ok: hasVideos,
            message: hasVideos ? "videos table found" : "videos table missing",
          });
        });
      } catch (e: any) {
        checks.push({
          name: "source_connectivity",
          ok: false,
          message: e?.message ? String(e.message) : "Failed to connect to source",
        });
      }
    }

    if (targetUrl) {
      try {
        await withPool(targetUrl, targetSslEnabled, async (pool) => {
          await pool.query("select 1 as ok");
          const hasVideos = await tableExists(pool, "videos");
          checks.push({
            name: "target_connectivity",
            ok: true,
            message: maskConnectionString(targetUrl),
          });
          checks.push({
            name: "target_schema",
            ok: hasVideos,
            message: hasVideos ? "videos table found" : "videos table missing (will be created)",
          });
        });
      } catch (e: any) {
        checks.push({
          name: "target_connectivity",
          ok: false,
          message: e?.message ? String(e.message) : "Failed to connect to target",
        });
      }
    }

    const ok = checks.every((c) => c.ok || c.name === "target_schema");
    return {
      ok,
      checks,
      context: {
        source: sourceUrl ? { configured: true, maskedUrl: maskConnectionString(sourceUrl), sslEnabled: sourceSslEnabled } : { configured: false, maskedUrl: null, sslEnabled: null },
        target: targetUrl ? { configured: true, maskedUrl: maskConnectionString(targetUrl), sslEnabled: targetSslEnabled } : { configured: false, maskedUrl: null, sslEnabled: null },
        migrationsFolder,
      },
    };
  }

  start(params: { mode: "full" | "incremental"; confirmText: string; startedBy: string }) {
    if (this.runningJobId) {
      return { ok: false as const, error: "A migration job is already running" };
    }
    if (params.confirmText !== "MIGRATE NOW") {
      return { ok: false as const, error: "Confirmation text mismatch" };
    }
    const jobId = crypto.randomUUID();
    const job: MigrationJob = {
      jobId,
      state: "queued",
      phase: "preparing",
      progressPct: 0,
      counters: {},
      startedAt: new Date().toISOString(),
      logs: [],
    };
    this.jobs.set(jobId, job);
    this.runningJobId = jobId;
    this.log(jobId, "info", `Job created by ${params.startedBy}`);
    this.log(jobId, "info", `Mode: ${params.mode}`);
    setImmediate(() => {
      this.runJob(jobId, params.mode).catch((e) => {
        const j = this.jobs.get(jobId);
        if (j) {
          j.state = "failed";
          j.errorMessage = e?.message ? String(e.message) : "Migration failed";
          j.finishedAt = new Date().toISOString();
          this.log(jobId, "error", j.errorMessage);
        }
        this.runningJobId = null;
      });
    });
    return { ok: true as const, jobId };
  }

  private async runJob(jobId: string, mode: "full" | "incremental") {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const migrationsFolder = getMigrationsFolder();
    const sourceUrl = this.getSourceUrl();
    const targetUrl = this.getTargetUrl();
    const sourceSslEnabled = parseBoolEnv(process.env.MIGRATION_SOURCE_DB_SSL, true);
    const targetSslEnabled = parseBoolEnv(process.env.MIGRATION_TARGET_DB_SSL, parseBoolEnv(process.env.DB_SSL, true));

    if (!migrationsFolder) throw new Error("Migrations folder not found");
    if (!sourceUrl) {
      throw new Error("No source DB configured (set MIGRATION_SOURCE_DATABASE_URL, or SUPABASE_POSTGRES_URL, or DB_URL)");
    }
    if (!targetUrl) {
      throw new Error("No target DB configured (set MIGRATION_TARGET_DATABASE_URL, or DATABASE_URL, or SUPABASE_POSTGRES_URL, or DB_URL)");
    }

    job.state = "running";
    job.phase = "migrating_schema";
    job.progressPct = 5;

    await withPool(targetUrl, targetSslEnabled, async (targetPool) => {
      this.log(jobId, "info", `Running schema migrations on target: ${maskConnectionString(targetUrl)}`);
      await applySqlMigrations(targetPool, migrationsFolder, (m) => this.log(jobId, "info", m));
    });

    job.phase = "copying";
    job.progressPct = 15;

    const excludedTables = new Set(["session", "__drizzle_migrations"]);

    await withPool(sourceUrl, sourceSslEnabled, async (sourcePool) => {
      await withPool(targetUrl, targetSslEnabled, async (targetPool) => {
        const sourceTables = (await listPublicTables(sourcePool)).filter((t) => !excludedTables.has(t));
        const targetTables = new Set((await listPublicTables(targetPool)).filter((t) => !excludedTables.has(t)));
        const tables = sourceTables.filter((t) => targetTables.has(t));

        if (tables.length === 0) {
          throw new Error("No common tables found between source and target");
        }

        this.log(jobId, "info", `Common tables: ${tables.length}`);

        await targetPool.query("set session_replication_role = 'replica'");
        try {
          if (mode === "full") {
            for (const tableName of tables) {
              await targetPool.query(`truncate table ${quoteIdent(tableName)} restart identity cascade`);
            }
            this.log(jobId, "info", "Target tables truncated" );
          }

          const perTableProgress = 70 / tables.length;
          let i = 0;

          for (const tableName of tables) {
            i++;
            const srcCols = await listCommonColumns(sourcePool, tableName);
            const tgtCols = await listCommonColumns(targetPool, tableName);
            const tgtColSet = new Set(tgtCols);
            const cols = srcCols.filter((c) => tgtColSet.has(c));
            if (cols.length === 0) {
              this.log(jobId, "warn", `Skipping ${tableName}: no common columns`);
              continue;
            }

            const countRes = await sourcePool.query(`select count(*)::int as c from ${quoteIdent(tableName)}`);
            const total = Number(countRes.rows?.[0]?.c || 0);
            job.counters = job.counters || {};
            job.counters[`${tableName}.total`] = total;
            job.counters[`${tableName}.copied`] = 0;

            this.log(jobId, "info", `Copying ${tableName} (${total})`);

            const batchSize = 1000;
            const valueChunkSize = 50;
            for (let offset = 0; offset < total; offset += batchSize) {
              const rowsRes = await sourcePool.query(
                `select ${cols.map(quoteIdent).join(", ")} from ${quoteIdent(tableName)} offset $1 limit $2`,
                [offset, batchSize],
              );
              const rows = rowsRes.rows;
              if (rows.length === 0) break;

              for (const group of chunk(rows, valueChunkSize)) {
                const placeholders: string[] = [];
                const values: any[] = [];
                let p = 1;
                for (const row of group) {
                  const rowPlaceholders: string[] = [];
                  for (const col of cols) {
                    values.push((row as any)[col]);
                    rowPlaceholders.push(`$${p++}`);
                  }
                  placeholders.push(`(${rowPlaceholders.join(",")})`);
                }
                const q = `insert into ${quoteIdent(tableName)} (${cols.map(quoteIdent).join(",")}) values ${placeholders.join(",")} on conflict do nothing`;
                await targetPool.query(q, values);
              }

              job.counters[`${tableName}.copied`] = Math.min(total, offset + rows.length);
            }

            job.progressPct = Math.min(90, 15 + Math.round(i * perTableProgress));
          }
        } finally {
          await targetPool.query("set session_replication_role = 'origin'");
        }
      });
    });

    job.phase = "validating";
    job.progressPct = 92;

    await withPool(sourceUrl, sourceSslEnabled, async (sourcePool) => {
      await withPool(targetUrl, targetSslEnabled, async (targetPool) => {
        const keyTables = ["channels", "videos", "categories"]; 
        for (const t of keyTables) {
          const srcOk = await tableExists(sourcePool, t);
          const tgtOk = await tableExists(targetPool, t);
          if (!srcOk || !tgtOk) continue;
          const [s, tt] = await Promise.all([
            sourcePool.query(`select count(*)::int as c from ${quoteIdent(t)}`),
            targetPool.query(`select count(*)::int as c from ${quoteIdent(t)}`),
          ]);
          job.counters = job.counters || {};
          job.counters[`${t}.sourceCount`] = Number(s.rows?.[0]?.c || 0);
          job.counters[`${t}.targetCount`] = Number(tt.rows?.[0]?.c || 0);
        }
      });
    });

    job.phase = "ready_for_cutover";
    job.progressPct = 100;
    job.state = "succeeded";
    job.finishedAt = new Date().toISOString();
    this.runningJobId = null;
    this.log(jobId, "info", "Migration completed" );
  }

  async cutover(params: { jobId: string; confirmText: string }) {
    if (params.confirmText !== "CUTOVER") {
      return { ok: false as const, error: "Confirmation text mismatch" };
    }

    const job = this.jobs.get(params.jobId);
    if (!job) return { ok: false as const, error: "Job not found" };
    if (job.state !== "succeeded" || job.phase !== "ready_for_cutover") {
      return { ok: false as const, error: "Job is not ready for cutover" };
    }

    const targetUrl = process.env.MIGRATION_TARGET_DATABASE_URL || process.env.DATABASE_URL;
    if (!targetUrl) return { ok: false as const, error: "Target database URL not set" };
    const targetSslEnabled = parseBoolEnv(process.env.MIGRATION_TARGET_DB_SSL, parseBoolEnv(process.env.DB_SSL, true));

    job.phase = "cutover";
    this.log(job.jobId, "warn", "Cutover started" );

    const prev = await switchDatabaseConnection({
      label: "target",
      connectionString: targetUrl,
      sslEnabled: targetSslEnabled,
    });

    this.lastCutoverPrev = prev;
    job.phase = "done";
    this.log(job.jobId, "info", "Cutover completed" );
    return { ok: true as const };
  }

  async rollback(params: { reason: string; confirmText: string }) {
    if (params.confirmText !== "ROLLBACK") {
      return { ok: false as const, error: "Confirmation text mismatch" };
    }
    if (!this.lastCutoverPrev?.connectionString || this.lastCutoverPrev.sslEnabled == null) {
      return { ok: false as const, error: "No previous connection available for rollback" };
    }

    await switchDatabaseConnection({
      label: this.lastCutoverPrev.label || "primary",
      connectionString: this.lastCutoverPrev.connectionString,
      sslEnabled: this.lastCutoverPrev.sslEnabled,
    });
    this.lastCutoverPrev = null;
    return { ok: true as const };
  }
}

export const adminMigrationService = new AdminMigrationService();
