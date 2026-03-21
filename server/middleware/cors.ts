import type { Request, Response, NextFunction } from "express";

export interface CorsConfig {
  origin?: string | string[] | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

export function getCorsConfig(): CorsConfig {
  const baseUrl = process.env.BASE_URL || process.env.APP_URL || "";
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) || [];
  
  const allOrigins = [
    baseUrl,
    ...allowedOrigins,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5001",
    "https://*.pages.dev",
    "https://*.vercel.app",
    "https://*.coolify.io",
  ].filter(Boolean);

  return {
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      
      const isAllowed = allOrigins.some((allowed) => {
        if (allowed.includes("*")) {
          const pattern = new RegExp("^" + allowed.replace(/\*/g, ".*") + "$");
          return pattern.test(origin);
        }
        return allowed === origin;
      });

      if (isAllowed || process.env.NODE_ENV === "development") {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Accept-Language",
      "X-CSRF-Token",
      "X-Fingerprint",
      "X-Client-Info",
      "X-Idempotency-Key",
    ],
    exposedHeaders: [
      "X-Request-Id",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "X-CSRF-Token",
      "ETag",
      "Cache-Control",
      "Content-Disposition",
    ],
    maxAge: 86400,
  };
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = getCorsConfig();
  const origin = req.headers.origin;

  if (origin && typeof config.origin === "function") {
    config.origin(origin, (err, allow) => {
      if (err || !allow) {
        return res.status(403).json({ error: "CORS not allowed" });
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", String(config.credentials));
      res.setHeader("Access-Control-Allow-Methods", config.methods?.join(", ") || "");
      res.setHeader("Access-Control-Allow-Headers", config.allowedHeaders?.join(", ") || "");
      res.setHeader("Access-Control-Max-Age", String(config.maxAge || 86400));
      if (config.exposedHeaders) {
        res.setHeader("Access-Control-Expose-Headers", config.exposedHeaders.join(", "));
      }
      next();
    });
  } else {
    if (typeof config.origin === "boolean") {
      res.setHeader("Access-Control-Allow-Origin", config.origin ? origin || "*" : "");
    } else if (config.origin) {
      const origins = Array.isArray(config.origin) ? config.origin : [config.origin];
      if (origins.includes(origin || "")) {
        res.setHeader("Access-Control-Allow-Origin", origin || "");
      }
    }
    if (config.credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (config.methods) {
      res.setHeader("Access-Control-Allow-Methods", config.methods.join(", "));
    }
    if (config.allowedHeaders) {
      res.setHeader("Access-Control-Allow-Headers", config.allowedHeaders.join(", "));
    }
    if (config.maxAge) {
      res.setHeader("Access-Control-Max-Age", String(config.maxAge));
    }
    if (config.exposedHeaders) {
      res.setHeader("Access-Control-Expose-Headers", config.exposedHeaders.join(", "));
    }
    next();
  }
}
