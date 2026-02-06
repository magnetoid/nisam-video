import type { Request, Response, NextFunction } from "express";
import { cache } from "./cache.js";
import crypto from "crypto";

interface CacheMiddlewareOptions {
  ttl?: number;
  publicRoutes?: string[];
  skipAuth?: boolean;
  scope?: "public" | "private";
}

const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes default
const CLOUDFLARE_TTL = 600; // 10 minutes edge cache
const VIDEO_API_TTL_MS = 60 * 1000;
const VIDEO_EDGE_TTL = 60;

const PUBLIC_CACHEABLE_ROUTES = [
  "/api/videos",
  "/api/videos/hero",
  "/api/videos/carousels",
  "/api/categories",
  "/api/tags",
  "/api/channels",
  "/api/system/settings",
  "/api/seo-settings",
  "/api/playlists",
];

const PRIVATE_ADMIN_CACHE_EXCLUDE = [
  "/api/admin/error-logs",
  "/api/admin/error-logs/stream",
  "/api/admin/error-logs/export",
];

function generateETag(data: unknown): string {
  const hash = crypto.createHash("md5");
  hash.update(JSON.stringify(data));
  return `"${hash.digest("hex")}"`;
}

function shouldCache(req: Request, scope: "public" | "private"): boolean {
  if (req.method !== "GET") return false;

  if (scope === "public") {
    if (req.session?.isAuthenticated) return false;
    if (req.path.startsWith("/api/admin")) return false;
    if (req.path.startsWith("/api/auth")) return false;
    const matchesRoute = PUBLIC_CACHEABLE_ROUTES.some(
      (route) => req.path === route || req.path.startsWith(route + "/"),
    );
    return matchesRoute;
  }

  if (!req.session?.isAuthenticated) return false;
  if (!req.path.startsWith("/api/admin")) return false;
  const isExcluded = PRIVATE_ADMIN_CACHE_EXCLUDE.some(
    (route) => req.path === route || req.path.startsWith(route + "/"),
  );
  if (isExcluded) return false;
  if (req.path.includes("/export")) return false;
  if (req.path.includes("/stream")) return false;
  return true;
}

function getCacheKey(req: Request, scope: "public" | "private"): string {
  const queryString = req.url.includes("?") ? req.url.split("?")[1] : "";
  if (scope === "private") {
    const sessionId = (req as any).sessionID || "anonymous";
    return `http-private:${sessionId}:${req.path}:${queryString}`;
  }
  return `http:${req.path}:${queryString}`;
}

function getEffectiveTtlMs(req: Request, scope: "public" | "private", defaultTtlMs: number): number {
  if (scope !== "public") return defaultTtlMs;
  if (req.path.startsWith("/api/videos")) return Math.min(defaultTtlMs, VIDEO_API_TTL_MS);
  return defaultTtlMs;
}

function getEdgeTtlSeconds(req: Request, scope: "public" | "private"): number {
  if (scope !== "public") return 0;
  if (req.path.startsWith("/api/videos")) return VIDEO_EDGE_TTL;
  return CLOUDFLARE_TTL;
}

export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const defaultTtl = options.ttl || DEFAULT_TTL;
  const scope: "public" | "private" = options.scope || "public";

  return (req: Request, res: Response, next: NextFunction) => {
    if (!shouldCache(req, scope)) {
      if (!res.getHeader("X-Cache")) {
        res.setHeader("X-Cache", "BYPASS");
      }
      return next();
    }

    const ttl = getEffectiveTtlMs(req, scope, defaultTtl);
    const edgeTtl = getEdgeTtlSeconds(req, scope);

    const cacheKey = getCacheKey(req, scope);
    const cachedData = cache.get<{ body: unknown; statusCode: number }>(cacheKey);

    if (cachedData) {
      const etag = generateETag(cachedData.body);
      const clientEtag = req.headers["if-none-match"];

      if (clientEtag === etag) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("ETag", etag);
        if (scope === "private") {
          res.setHeader("Vary", "Cookie");
          res.setHeader("Cache-Control", "private, max-age=30, must-revalidate");
        } else {
          res.setHeader(
            "Cache-Control",
            `public, s-maxage=${edgeTtl}, stale-while-revalidate=60`,
          );
        }
        return res.status(304).end();
      }

      res.setHeader("X-Cache", "HIT");
      res.setHeader("ETag", etag);
      if (scope === "private") {
        res.setHeader("Vary", "Cookie");
        res.setHeader("Cache-Control", "private, max-age=30, must-revalidate");
      } else {
        res.setHeader(
          "Cache-Control",
          `public, s-maxage=${edgeTtl}, stale-while-revalidate=60`,
        );
      }
      return res.status(cachedData.statusCode).json(cachedData.body);
    }

    res.setHeader("X-Cache", "MISS");

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, { body, statusCode: res.statusCode }, ttl);
        const etag = generateETag(body);
        res.setHeader("ETag", etag);
        if (scope === "private") {
          res.setHeader("Vary", "Cookie");
          res.setHeader("Cache-Control", "private, max-age=30, must-revalidate");
        } else {
          res.setHeader(
            "Cache-Control",
            `public, s-maxage=${edgeTtl}, stale-while-revalidate=60`,
          );
        }
      }
      return originalJson(body);
    };

    next();
  };
}

export function invalidateCacheOnMutation(pattern?: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (_req.method !== "GET" && res.statusCode >= 200 && res.statusCode < 300) {
        if (pattern) {
          cache.invalidatePattern(pattern);
        } else {
          cache.invalidatePattern("^http:");
        }
      }
      return originalJson(body);
    };
    next();
  };
}
