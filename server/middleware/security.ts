import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";

export function getHelmetConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const baseUrl = process.env.BASE_URL || process.env.APP_URL || "";
  
  const allowedOrigins = [
    baseUrl,
    ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || []),
  ].filter(Boolean);

  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction
          ? ["'self'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "https://img.youtube.com",
          "https://i.ytimg.com",
          "https://*.ytimg.com",
          "https://*.googlevideo.com",
          "https://*.tiktok.com",
          "https://*.tiktokcdn.com",
          "https://pbs.twimg.com",
          "https://*.ctfassets.net",
          "https://images.unsplash.com",
        ],
        mediaSrc: [
          "'self'",
          "https:",
          "https://*.youtube.com",
          "https://*.googlevideo.com",
          "https://*.tiktok.com",
          "https://*.tiktokcdn.com",
        ],
        connectSrc: [
          "'self'",
          "https://",
          "wss://",
          ...allowedOrigins,
        ],
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
          "https://player.tiktok.com",
        ],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  };
}

export function createRateLimiters() {
  const isProduction = process.env.NODE_ENV === "production";
  
  const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,  // increased from 100 - SPA makes many API calls per page
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 5 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    message: { 
      error: "Too many authentication attempts, please try again later.",
      retryAfter: 900 
    },
    keyGenerator: (req) => {
      const forwarded = req.headers["x-forwarded-for"];
      const ip = typeof forwarded === "string" 
        ? forwarded.split(",")[0].trim() 
        : req.ip;
      return `auth:${ip}`;
    },
  });

  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,  // increased from 60
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/api/videos") || req.path.startsWith("/api/channels") || req.path.startsWith("/api/categories") || req.path.startsWith("/api/tags"),
    message: { error: "API rate limit exceeded, please slow down." },
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Upload rate limit exceeded. Please try again in an hour." },
  });

  const sensitiveActionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many sensitive actions. Please try again in an hour." },
  });

  return {
    standard: standardLimiter,
    auth: authLimiter,
    api: apiLimiter,
    upload: uploadLimiter,
    sensitiveAction: sensitiveActionLimiter,
  };
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function validateCsrfToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const expected = createHmac("sha256", secret)
    .update(token)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected.slice(0, 64))
  );
}

export function csrfMiddleware(secret: string) {
  return (req: any, res: any, next: any) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const token = generateCsrfToken();
      req.session.csrfToken = token;
      res.setHeader("X-CSRF-Token", token);
      return next();
    }

    const token = req.headers["x-csrf-token"];
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).json({ 
        error: "Invalid or missing CSRF token",
        code: "CSRF_INVALID"
      });
    }
    next();
  };
}
