import { createHash } from "crypto";
import { EventEmitter } from "events";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "./db.js";
import { errorBookmarks, errorEvents } from "../shared/schema.js";

type ErrorLevel = "debug" | "info" | "warn" | "error" | "critical";

export type ErrorEventInput = {
  level: ErrorLevel;
  type: string;
  message: string;
  stack?: string;
  module?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  context?: unknown;
};

type ListFilters = {
  q?: string;
  level?: string;
  type?: string;
  module?: string;
  userId?: string;
  fingerprint?: string;
  from?: Date;
  to?: Date;
  bookmarked?: boolean;
  limit: number;
  cursor?: string;
};

export const errorLogBus = new EventEmitter();

const memoryEvents = new Map<string, any>();
const memoryBookmarks = new Map<string, { fingerprint: string; note: string | null; createdAt: Date }>();

function safeString(value: unknown, maxLen = 20000): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = typeof value === "string" ? value : String(value);
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
}

function redactKey(key: string): boolean {
  return /(authorization|cookie|password|token|secret|apikey|api_key|set-cookie)/i.test(
    key,
  );
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "string") return safeString(value, 10000);
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeUnknown(v, depth + 1));
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).slice(0, 50);
    for (const k of keys) {
      if (redactKey(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitizeUnknown(obj[k], depth + 1);
      }
    }
    return out;
  }
  return safeString(value);
}

function fingerprintFor(input: ErrorEventInput): string {
  const base = [
    input.type,
    input.module || "",
    input.message,
    input.stack || "",
    input.method || "",
    input.url || "",
    input.statusCode ? String(input.statusCode) : "",
  ].join("|");
  return createHash("sha256").update(base).digest("hex").slice(0, 32);
}

function parseCursor(cursor?: string): { lastSeenAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { lastSeenAt: string; id: string };
    if (!parsed?.lastSeenAt || !parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function makeCursor(lastSeenAt: Date, id: string): string {
  const json = JSON.stringify({ lastSeenAt: lastSeenAt.toISOString(), id });
  return Buffer.from(json, "utf8").toString("base64url");
}

async function maybeNotifyCritical(input: ErrorEventInput, fingerprint: string) {
  if (input.level !== "critical") return;
  const url = process.env.ERROR_NOTIFICATION_WEBHOOK_URL;
  if (!url) return;
  try {
    const payload = {
      fingerprint,
      level: input.level,
      type: input.type,
      message: input.message,
      module: input.module,
      url: input.url,
      statusCode: input.statusCode,
      lastSeenAt: new Date().toISOString(),
    };
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
  }
}

async function enforceRetention() {
  const daysRaw = process.env.ERROR_LOG_RETENTION_DAYS;
  const days = Math.max(1, Math.min(365, parseInt(daysRaw || "30", 10) || 30));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    await db.delete(errorEvents).where(lte(errorEvents.lastSeenAt, cutoff));
  } catch {
  }
}

export async function recordError(input: ErrorEventInput) {
  const now = new Date();
  const fingerprint = fingerprintFor(input);
  const sanitizedContext = sanitizeUnknown(input.context);

  try {
    const [row] = await db
      .insert(errorEvents)
      .values({
        fingerprint,
        level: input.level,
        type: input.type,
        message: safeString(input.message, 20000) || "Unknown error",
        stack: safeString(input.stack, 50000),
        module: safeString(input.module, 200),
        url: safeString(input.url, 2000),
        method: safeString(input.method, 20),
        statusCode: input.statusCode,
        userId: safeString(input.userId, 200),
        sessionId: safeString(input.sessionId, 200),
        userAgent: safeString(input.userAgent, 1000),
        ip: safeString(input.ip, 100),
        context: sanitizedContext as any,
        firstSeenAt: now,
        lastSeenAt: now,
        count: 1,
      })
      .onConflictDoUpdate({
        target: errorEvents.fingerprint,
        set: {
          level: input.level,
          type: input.type,
          message: safeString(input.message, 20000) || "Unknown error",
          stack: safeString(input.stack, 50000),
          module: safeString(input.module, 200),
          url: safeString(input.url, 2000),
          method: safeString(input.method, 20),
          statusCode: input.statusCode,
          userId: safeString(input.userId, 200),
          sessionId: safeString(input.sessionId, 200),
          userAgent: safeString(input.userAgent, 1000),
          ip: safeString(input.ip, 100),
          context: sanitizedContext as any,
          lastSeenAt: now,
          count: sql`${errorEvents.count} + 1`,
        },
      })
      .returning();

    errorLogBus.emit("error_event", { fingerprint, level: input.level });
    await maybeNotifyCritical(input, fingerprint);
    enforceRetention();
    return row;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("error_events") && (message.includes("does not exist") || message.includes("relation"))) {
      const existing = memoryEvents.get(fingerprint);
      if (existing) {
        existing.lastSeenAt = now;
        existing.count += 1;
        existing.level = input.level;
        existing.type = input.type;
        existing.message = safeString(input.message, 20000) || "Unknown error";
        existing.stack = safeString(input.stack, 50000) || null;
        existing.module = safeString(input.module, 200) || null;
        existing.url = safeString(input.url, 2000) || null;
        existing.method = safeString(input.method, 20) || null;
        existing.statusCode = input.statusCode ?? null;
        existing.userId = safeString(input.userId, 200) || null;
        existing.sessionId = safeString(input.sessionId, 200) || null;
        existing.userAgent = safeString(input.userAgent, 1000) || null;
        existing.ip = safeString(input.ip, 100) || null;
        existing.context = sanitizedContext as any;
        memoryEvents.set(fingerprint, existing);
      } else {
        memoryEvents.set(fingerprint, {
          id: createHash("sha1").update(`${fingerprint}-${now.toISOString()}`).digest("hex").slice(0, 16),
          fingerprint,
          level: input.level,
          type: input.type,
          message: safeString(input.message, 20000) || "Unknown error",
          stack: safeString(input.stack, 50000) || null,
          module: safeString(input.module, 200) || null,
          url: safeString(input.url, 2000) || null,
          method: safeString(input.method, 20) || null,
          statusCode: input.statusCode ?? null,
          userId: safeString(input.userId, 200) || null,
          sessionId: safeString(input.sessionId, 200) || null,
          userAgent: safeString(input.userAgent, 1000) || null,
          ip: safeString(input.ip, 100) || null,
          context: sanitizedContext as any,
          firstSeenAt: now,
          lastSeenAt: now,
          count: 1,
        });
      }

      errorLogBus.emit("error_event", { fingerprint, level: input.level });
      await maybeNotifyCritical(input, fingerprint);
      return memoryEvents.get(fingerprint);
    }

    console.error("[error-logs] recordError failed:", error);
    return null;
  }
}

export async function listErrorEvents(filters: ListFilters) {
  try {
  const whereParts: any[] = [];
  if (filters.level) whereParts.push(eq(errorEvents.level, filters.level));
  if (filters.type) whereParts.push(eq(errorEvents.type, filters.type));
  if (filters.module) whereParts.push(ilike(errorEvents.module, `%${filters.module}%`));
  if (filters.userId) whereParts.push(eq(errorEvents.userId, filters.userId));
  if (filters.fingerprint) whereParts.push(eq(errorEvents.fingerprint, filters.fingerprint));
  if (filters.from) whereParts.push(gte(errorEvents.lastSeenAt, filters.from));
  if (filters.to) whereParts.push(lte(errorEvents.lastSeenAt, filters.to));
  if (filters.q) {
    whereParts.push(
      or(
        ilike(errorEvents.message, `%${filters.q}%`),
        ilike(errorEvents.stack, `%${filters.q}%`),
        ilike(errorEvents.module, `%${filters.q}%`),
      ),
    );
  }

  const cursor = parseCursor(filters.cursor);
  if (cursor) {
    whereParts.push(
      or(
        lte(errorEvents.lastSeenAt, new Date(cursor.lastSeenAt)),
        and(
          eq(errorEvents.lastSeenAt, new Date(cursor.lastSeenAt)),
          lte(errorEvents.id, cursor.id),
        ),
      ),
    );
  }

  const baseWhere = whereParts.length ? and(...whereParts) : undefined;

  const limit = Math.max(1, Math.min(200, filters.limit || 50));

  if (filters.bookmarked) {
    const rows = await db
      .select({ event: errorEvents, bookmark: errorBookmarks })
      .from(errorEvents)
      .innerJoin(errorBookmarks, eq(errorBookmarks.fingerprint, errorEvents.fingerprint))
      .where(baseWhere)
      .orderBy(desc(errorEvents.lastSeenAt), desc(errorEvents.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const sliced = rows.slice(0, limit);
    const items = sliced.map((r: any) => ({ ...r.event, bookmarked: true, bookmarkNote: r.bookmark.note }));
    const nextCursor = hasMore ? makeCursor(sliced[sliced.length - 1].event.lastSeenAt, sliced[sliced.length - 1].event.id) : null;
    return { items, nextCursor };
  }

  const rows = await db
    .select({ event: errorEvents, bookmark: errorBookmarks })
    .from(errorEvents)
    .leftJoin(errorBookmarks, eq(errorBookmarks.fingerprint, errorEvents.fingerprint))
    .where(baseWhere)
    .orderBy(desc(errorEvents.lastSeenAt), desc(errorEvents.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);
  const items = sliced.map((r: any) => ({
    ...r.event,
    bookmarked: !!r.bookmark,
    bookmarkNote: r.bookmark?.note || null,
  }));
  const nextCursor = hasMore ? makeCursor(sliced[sliced.length - 1].event.lastSeenAt, sliced[sliced.length - 1].event.id) : null;
  return { items, nextCursor };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("error_events") && (message.includes("does not exist") || message.includes("relation"))) {
      const all = Array.from(memoryEvents.values());
      const filtered = all.filter((e) => {
        if (filters.level && e.level !== filters.level) return false;
        if (filters.type && e.type !== filters.type) return false;
        if (filters.module && !(e.module || "").toLowerCase().includes(filters.module.toLowerCase())) return false;
        if (filters.userId && e.userId !== filters.userId) return false;
        if (filters.fingerprint && e.fingerprint !== filters.fingerprint) return false;
        if (filters.from && new Date(e.lastSeenAt).getTime() < filters.from.getTime()) return false;
        if (filters.to && new Date(e.lastSeenAt).getTime() > filters.to.getTime()) return false;
        if (filters.q) {
          const qq = filters.q.toLowerCase();
          const hay = `${e.message || ""}\n${e.stack || ""}\n${e.module || ""}`.toLowerCase();
          if (!hay.includes(qq)) return false;
        }
        if (filters.bookmarked) {
          if (!memoryBookmarks.has(e.fingerprint)) return false;
        }
        return true;
      });

      filtered.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

      const cursorParsed = parseCursor(filters.cursor || undefined);
      const afterCursor = cursorParsed
        ? filtered.filter((e) => {
            const t = new Date(e.lastSeenAt).toISOString();
            if (t < cursorParsed.lastSeenAt) return true;
            if (t === cursorParsed.lastSeenAt && e.id <= cursorParsed.id) return true;
            return false;
          })
        : filtered;

      const limit = Math.max(1, Math.min(200, filters.limit || 50));
      const page = afterCursor.slice(0, limit + 1);
      const hasMore = page.length > limit;
      const sliced = page.slice(0, limit);
      const items = sliced.map((e) => {
        const bm = memoryBookmarks.get(e.fingerprint);
        return { ...e, bookmarked: !!bm, bookmarkNote: bm?.note || null };
      });
      const nextCursor = hasMore ? makeCursor(new Date(sliced[sliced.length - 1].lastSeenAt), sliced[sliced.length - 1].id) : null;
      return { items, nextCursor };
    }
    throw error;
  }
}

export async function toggleBookmark(fingerprint: string, note?: string) {
  try {
    const existing = await db.select().from(errorBookmarks).where(eq(errorBookmarks.fingerprint, fingerprint)).limit(1);
    if (existing.length) {
      await db.delete(errorBookmarks).where(eq(errorBookmarks.fingerprint, fingerprint));
      return { bookmarked: false };
    }
    await db
      .insert(errorBookmarks)
      .values({ fingerprint, note: safeString(note, 2000) || null })
      .onConflictDoNothing();
    return { bookmarked: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("error_bookmarks") && (message.includes("does not exist") || message.includes("relation"))) {
      if (memoryBookmarks.has(fingerprint)) {
        memoryBookmarks.delete(fingerprint);
        return { bookmarked: false };
      }
      memoryBookmarks.set(fingerprint, { fingerprint, note: safeString(note, 2000) || null, createdAt: new Date() });
      return { bookmarked: true };
    }
    throw error;
  }
}

export async function listBookmarks(limit = 200) {
  try {
    const rows = await db
      .select()
      .from(errorBookmarks)
      .orderBy(desc(errorBookmarks.createdAt))
      .limit(Math.max(1, Math.min(500, limit)));
    return rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("error_bookmarks") && (message.includes("does not exist") || message.includes("relation"))) {
      return Array.from(memoryBookmarks.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, Math.max(1, Math.min(500, limit)));
    }
    throw error;
  }
}
