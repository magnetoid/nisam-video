import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getUserIdentifier } from "../utils.js";
import { insertErrorEventSchema } from "../../shared/schema.js";
import { recordError } from "../error-log-service.js";
import { listErrorEvents } from "../error-log-service.js";
import { z } from "zod";

const router = Router();

router.post("/public/error-logs", async (req, res) => {
  try {
    const parsed = insertErrorEventSchema.parse(req.body);
    const ip = req.ip;
    const userAgent = req.headers["user-agent"];

    await recordError({
      level: parsed.level as any,
      type: parsed.type,
      message: parsed.message,
      stack: parsed.stack,
      module: parsed.module,
      url: parsed.url,
      method: parsed.method,
      statusCode: parsed.statusCode,
      userId: parsed.userId,
      sessionId: parsed.sessionId || (req as any).sessionID,
      userAgent: typeof userAgent === "string" ? userAgent : Array.isArray(userAgent) ? userAgent[0] : undefined,
      ip,
      context: parsed.context ?? null,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid error log payload" });
  }
});

router.get("/public/error-logs", async (req, res) => {
  const token = process.env.PUBLIC_ERROR_LOGS_TOKEN;
  const requestToken = typeof req.query.token === "string" ? req.query.token : "";
  if (!token || requestToken !== token) {
    return res.status(404).send("Not Found");
  }

  const schema = z.object({
    limit: z
      .string()
      .optional()
      .transform((v) => {
        const n = parseInt(v || "100", 10);
        return Number.isFinite(n) ? Math.max(1, Math.min(200, n)) : 100;
      }),
    levels: z
      .string()
      .optional()
      .transform((v) => (v || "error,warn").split(",").map((s) => s.trim()).filter(Boolean)),
    q: z.string().optional().transform((v) => (v || "").trim()).optional(),
  });

  const parsed = schema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 100;
  const levels = parsed.success ? parsed.data.levels : ["error", "warn"];
  const q = parsed.success ? parsed.data.q : undefined;

  const allowedLevels = new Set(["debug", "info", "warn", "error", "critical"]);
  const requestedLevels = levels.filter((l) => allowedLevels.has(l));
  const effectiveLevels = requestedLevels.length ? requestedLevels : ["error", "warn"];

  const results = await Promise.all(
    effectiveLevels.map((level) =>
      listErrorEvents({
        limit,
        level,
        q: q || undefined,
      } as any),
    ),
  );

  const merged = results
    .flatMap((r) => r.items)
    .sort((a: any, b: any) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .slice(0, limit)
    .map((e: any) => ({
      id: e.id,
      fingerprint: e.fingerprint,
      level: e.level,
      type: e.type,
      message: e.message,
      stack: e.stack,
      module: e.module,
      url: e.url,
      method: e.method,
      statusCode: e.statusCode,
      firstSeenAt: e.firstSeenAt,
      lastSeenAt: e.lastSeenAt,
      count: e.count,
    }));

  res.setHeader("Cache-Control", "no-store");
  return res.json({ items: merged });
});

// Client Logging Route
router.post("/client-logs", async (req, res) => {
  try {
    // Check if logging is enabled
    const { systemSettings: settingsTable, activityLogs: logsTable } = await import("../../shared/schema.js");
    const [settings] = await db.select().from(settingsTable).limit(1);
    
    if (!settings || settings.clientErrorLogging !== 1) {
      return res.json({ success: false, message: "Logging disabled" });
    }

    const { error, info, url } = req.body;
    const userIdentifier = getUserIdentifier(req);

    await db.insert(logsTable).values({
      action: "client_error",
      entityType: "error",
      username: userIdentifier,
      details: JSON.stringify({ error, info, url, userAgent: req.headers["user-agent"] }),
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Client logging error:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("activity_logs") &&
      (message.includes("does not exist") || message.includes("relation"))
    ) {
      return res.json({ success: false, message: "Logging unavailable" });
    }
    res.status(500).json({ error: "Failed to log client error" });
  }
});

// Activity logs routes
router.get("/activity-logs", requireAuth, async (req, res) => {
  try {
    const { activityLogs: logsTable } = await import("../../shared/schema.js");
    // We need sql from drizzle-orm
    const { sql: sqlOp } = await import("drizzle-orm");
    
    const logs = await db
      .select()
      .from(logsTable)
      .orderBy(sqlOp`${logsTable.createdAt} DESC`)
      .limit(500);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("activity_logs") &&
      (message.includes("does not exist") || message.includes("relation"))
    ) {
      return res.json([]);
    }
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

export default router;
