import type { Request, Response, NextFunction } from "express";
import { cache } from "./cache";
import crypto from "crypto";

interface CacheMiddlewareOptions {
  ttl?: number;
  publicRoutes?: string[];
  skipAuth?: boolean;
}

const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes default
const CLOUDFLARE_TTL = 600; // 10 minutes edge cache

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

function generateETag(data: unknown): string {
  const hash = crypto.createHash("md5");
  hash.update(JSON.stringify(data));
  return `"${hash.digest("hex")}"`;
}

function shouldCache(req: Request): boolean {
  if (req.method !== "GET") return false;
  if (req.session?.isAuthenticated) return false;
  if (req.path.includes("/admin")) return false;
  const matchesRoute = PUBLIC_CACHEABLE_ROUTES.some(
    (route) => req.path === route || req.path.startsWith(route + "/")
  );
  return matchesRoute;
}

function getCacheKey(req: Request): string {
  const queryString = req.url.includes("?") ? req.url.split("?")[1] : "";
  return `http:${req.path}:${queryString}`;
}

export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const ttl = options.ttl || DEFAULT_TTL;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!shouldCache(req)) {
      res.setHeader("X-Cache", "BYPASS");
      if (req.path.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      return next();
    }

    const cacheKey = getCacheKey(req);
    const cachedData = cache.get<{ body: unknown; statusCode: number }>(cacheKey);

    if (cachedData) {
      const etag = generateETag(cachedData.body);
      const clientEtag = req.headers["if-none-match"];

      if (clientEtag === etag) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("ETag", etag);
        res.setHeader("Cache-Control", `public, s-maxage=${CLOUDFLARE_TTL}, stale-while-revalidate=60`);
        return res.status(304).end();
      }

      res.setHeader("X-Cache", "HIT");
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", `public, s-maxage=${CLOUDFLARE_TTL}, stale-while-revalidate=60`);
      return res.status(cachedData.statusCode).json(cachedData.body);
    }

    res.setHeader("X-Cache", "MISS");

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, { body, statusCode: res.statusCode }, ttl);
        const etag = generateETag(body);
        res.setHeader("ETag", etag);
        res.setHeader("Cache-Control", `public, s-maxage=${CLOUDFLARE_TTL}, stale-while-revalidate=60`);
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
      if (res.statusCode >= 200 && res.statusCode < 300) {
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
