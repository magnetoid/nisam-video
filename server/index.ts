import "dotenv/config"; // Ensure env vars are loaded first
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import compression from "compression";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { pool, isDbReady } from "./db.js";
import { getHelmetConfig, createRateLimiters, csrfMiddleware } from "./middleware/security.js";
import { corsMiddleware } from "./middleware/cors.js";
import { registerRoutes } from "./routes.js";
import publicRoutes from "./routes/public.js";
import { scheduler } from "./scheduler.js";
import { cacheMiddleware } from "./cache-middleware.js";
import { storage } from "./storage/index.js";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { errorMonitor, asyncHandler } from "./error-monitor.js";
import { recordError } from "./error-log-service.js";
import { recordRequestMetric } from "./performance-metrics.js";
import { runMigrations } from "./migrate.js";
import { startCronJobs } from "./services/cron.js";
import { getHealthSnapshot, startHealthProbes } from "./health.js";
import { sitemapHandler, robotsHandler } from "./routes/public.js";

const app = express();

if (pool) {
  pool.on("error", (err: any) => {
    recordError({
      level: "critical",
      type: "db_pool_error",
      message: err?.message || String(err),
      stack: err?.stack,
      module: "db",
    });
  });
}

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Enable gzip compression for all responses
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    const accept = req.headers["accept"];
    if (typeof accept === "string" && accept.includes("text/event-stream")) {
      return false;
    }
    if (typeof req.path === "string" && req.path.includes("/stream")) {
      return false;
    }
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Record the error
  recordError({
    level: "critical",
    type: "unhandled_rejection",
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    module: "process",
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Record the error
  recordError({
    level: "critical",
    type: "uncaught_exception",
    message: error.message,
    stack: error.stack,
    module: "process",
  });
  
  const shouldExit = process.env.EXIT_ON_UNCAUGHT_EXCEPTION === "1";
  if (shouldExit) {
    process.exit(1);
  }
});

// Trust proxy for Cloudflare, Coolify (Traefik/Caddy), and other reverse proxies
app.set("trust proxy", 1); // Trust the first proxy (Coolify/Traefik) so secure cookies work

const PgStore = connectPgSimple(session);

function getSessionSecret() {
  const raw = typeof process.env.SESSION_SECRET === "string" ? process.env.SESSION_SECRET.trim() : "";
  if (raw.length >= 32) return raw;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production and must be at least 32 characters");
  }

  const generated = crypto.randomBytes(32).toString("hex");
  log("SESSION_SECRET not set; using ephemeral secret for this process", "config");
  return generated;
}

const sessionConfig: session.SessionOptions = {
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  rolling: true, // Renew session cookie on every response
  name: "nisam.sid", // Use a custom name to avoid generic sid conflicts
  cookie: {
    secure: process.env.NODE_ENV === "production" || process.env.COOLIFY_URL !== undefined,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' for cross-origin deployments
  },
};

if (process.env.NODE_ENV === "production" && pool) {
  const primaryStore = new PgStore({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  });
  const fallbackStore = new session.MemoryStore();

  class HybridSessionStore extends session.Store {
    private isDbHealthy() {
      try {
        const deps = getHealthSnapshot();
        return deps.database.configured && deps.database.ok;
      } catch {
        return false;
      }
    }

    private store() {
      return this.isDbHealthy() ? primaryStore : fallbackStore;
    }

    get(sid: string, cb: (err: any, session?: any | null) => void) {
      this.store().get(sid, (err: any, sess: any) => {
        if (!err) {
          // If we queried primary and got nothing, maybe check fallback just in case
          if (!sess && this.store() === primaryStore) {
            fallbackStore.get(sid, (_e: any, fallbackSess: any) => cb(null, fallbackSess));
            return;
          }
          return cb(null, sess);
        }
        // On error (e.g., DB down), log it but don't instantly wipe session by falling back to empty memory store
        console.error(`[Session] Store get error for sid ${sid}:`, err?.message || err);
        fallbackStore.get(sid, (_e: any, fallbackSess: any) => {
          // If memory store doesn't have it, we return the error to prevent silent logout
          if (!fallbackSess) return cb(err);
          cb(null, fallbackSess);
        });
      });
    }

    set(sid: string, sess: any, cb: (err?: any) => void) {
      this.store().set(sid, sess, (err: any) => {
        if (!err) return cb(null);
        fallbackStore.set(sid, sess, () => cb(null));
      });
    }

    destroy(sid: string, cb: (err?: any) => void) {
      this.store().destroy(sid, (err: any) => {
        if (!err) return cb(null);
        fallbackStore.destroy(sid, () => cb(null));
      });
    }

    touch(sid: string, sess: any, cb: (err?: any) => void) {
      const s: any = this.store();
      if (typeof s.touch === "function") {
        s.touch(sid, sess, (err: any) => {
          if (!err) return cb(null);
          const f: any = fallbackStore;
          if (typeof f.touch === "function") f.touch(sid, sess, () => cb(null));
          else cb(null);
        });
        return;
      }
      cb(null);
    }
  }

  sessionConfig.store = new HybridSessionStore();
}

app.use(session(sessionConfig));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security middleware - Helmet
app.use(helmet(getHelmetConfig()));

// CORS middleware
app.use(corsMiddleware);

// Rate limiting - general
const rateLimiters = createRateLimiters();
app.use(rateLimiters.standard);

// Request body size limits
app.use(express.json({ 
  limit: "10mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(express.raw({ limit: "25mb", type: () => true }));

// Cloudflare-optimized caching headers middleware
app.use((req, res, next) => {
  // Static assets should be cached aggressively
  if (
    req.path.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("CDN-Cache-Control", "public, max-age=31536000");
  }
  // Auth routes should not be cached
  else if (req.path.startsWith("/api/auth")) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  // Admin GET responses can be privately cached in-browser for short periods
  else if (req.path.startsWith("/api/admin")) {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "private, max-age=30, must-revalidate");
      res.setHeader("Vary", "Cookie");
    } else {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
  // Public API routes - caching handled by cacheMiddleware, don't set headers here
  else if (req.path.startsWith("/api/")) {
    // Let cache middleware handle public API routes
  }
  // HTML pages - short cache for Cloudflare edge
  else if (req.path.endsWith(".html") || !req.path.includes(".")) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600"); // 1 hour on edge
  }

  // Note: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
  // are now handled by Helmet middleware

  next();
});

// API caching middleware
app.use(cacheMiddleware({ scope: "public" }));
app.use(cacheMiddleware({ scope: "private", ttl: 30 * 1000 }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      recordRequestMetric({
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
      });
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 500) {
        logLine = logLine.slice(0, 499) + "…";
      }

      log(logLine);

      if (res.statusCode >= 500) {
        const msg =
          (capturedJsonResponse && (capturedJsonResponse.error || capturedJsonResponse.message)) ||
          `API response ${res.statusCode}`;
        recordError({
          level: "error",
          type: "api_failure",
          message: typeof msg === "string" ? msg : JSON.stringify(msg),
          module: "api",
          url: req.originalUrl || req.url,
          method: req.method,
          statusCode: res.statusCode,
          sessionId: (req as any).sessionID,
          userAgent: req.get("User-Agent"),
          ip: req.ip,
          context: {
            durationMs: duration,
            query: req.query,
            params: req.params,
          },
        });
      }
    }
  });

  next();
});

// Global static SEO files
app.get("/sitemap.xml", sitemapHandler);
app.get("/robots.txt", robotsHandler);

// Create startup function
async function startServer() {
  const initStart = Date.now();
  log("Starting server initialization...");

  startHealthProbes();

  // Run database migrations on startup
  if (process.env.VERCEL !== "1") {
    try {
      log("Checking for pending migrations...");
      await runMigrations();
    } catch (error: any) {
      log(`Migration check failed: ${error.message}`);
    }
  } else {
    log("Skipping migrations in Vercel environment");
  }

  log("Registering routes...");
  const routesStart = Date.now();
  const server = await registerRoutes(app);
  log(`Routes registered in ${Date.now() - routesStart}ms`);

  // Public routes
  app.use("/api", publicRoutes);

  // Catch-all for unmatched API routes (must be after all other API routes)
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Health check endpoint with error monitoring
  app.get("/health", (req, res) => {
    const healthStatus = errorMonitor.getHealthStatus();
    const deps = getHealthSnapshot();
    const dbStatus = {
      ready: isDbReady(),
      pool: pool ? 'connected' : 'disconnected',
    };

    const degraded =
      (deps.database.configured && !deps.database.ok) ||
      (deps.redis.configured && !deps.redis.ok);

    res.status(200).json({
      status: degraded ? "degraded" : healthStatus.status,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      dependencies: deps,
      errorMonitor: healthStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  // Deep health check — verifies actual DB and Redis connectivity
  app.get("/health/deep", async (req, res) => {
    const results: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

    // Check database
    if (pool) {
      const start = Date.now();
      try {
        await pool.query("SELECT 1 AS ok");
        results.database = { ok: true, latencyMs: Date.now() - start };
      } catch (err: any) {
        results.database = { ok: false, latencyMs: Date.now() - start, error: err.message };
      }
    } else {
      results.database = { ok: false, error: "Pool not initialized" };
    }

    // Check Redis
    try {
      const { getRedisClient } = await import("./services/redis.js");
      const redis = getRedisClient();
      if (redis) {
        const start = Date.now();
        await redis.ping();
        results.redis = { ok: true, latencyMs: Date.now() - start };
      } else {
        results.redis = { ok: true, latencyMs: 0 }; // Not configured = not a failure
      }
    } catch (err: any) {
      results.redis = { ok: false, error: err.message };
    }

    const allOk = Object.values(results).every((r) => r.ok);
    res.status(allOk ? 200 : 503).json({
      status: allOk ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks: results,
    });
  });



  const schedulerDisabled = process.env.DISABLE_SCHEDULER === "1" || process.env.VERCEL === "1";
  if (schedulerDisabled) {
    log("Scheduler initialization skipped (DISABLE_SCHEDULER=1 or VERCEL=1)");
  } else {
    log("Initializing scheduler...");
    const schedStart = Date.now();
    try {
      await scheduler.init();
      log(`Scheduler initialized in ${Date.now() - schedStart}ms`);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Scheduler initialization failed (continuing without scheduler): ${message}`);
    }
  }

  // Start background jobs
  startCronJobs();

  // Warm cache on startup to eliminate cold-start delays
  // Wrap in try-catch and don't await to avoid blocking startup in serverless
  // Skip in Vercel to prevent cold start delays
  if (process.env.VERCEL !== '1') {
    log("Warming cache...");
    const warmStart = Date.now();
    Promise.all([
      storage.getSeoSettings(),
      storage.getAllLocalizedCategories('en'),
      storage.getRecentVideos(10),
    ]).then(() => {
      log(`Cache warming completed in ${Date.now() - warmStart}ms`);
    }).catch((err) => log(`Cache warming failed: ${err.message}`));
    
    log("Cache warming initiated");
  } else {
    log("Skipping cache warming in Vercel environment");
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Only import vite-dev in development
    try {
      log("Setting up Vite dev server...");
      const viteStart = Date.now();
      const viteDevModule = process.env.VITE_DEV_MODULE_PATH ?? "./vite-dev.js";
      const { setupVite } = await import(viteDevModule);
      await setupVite(app, server);
      log(`Vite setup completed in ${Date.now() - viteStart}ms`);
    } catch (err) {
      console.error("Failed to load vite-dev:", err);
    }
  } else {
    // In serverless/production, we might not have static files locally (served by edge)
    // So we wrap this in try-catch or check existence to avoid crash
    log("Setting up static serving...");
    const staticStart = Date.now();
    try {
      const { serveStatic } = await import("./serve-static.js");
      serveStatic(app);
      log(`Static serving setup in ${Date.now() - staticStart}ms`);
    } catch (e) {
      console.warn("Skipping static file serving (expected in serverless if 'dist' missing):", e);
      log(`Static serving skipped due to error`);
    }
  }

  // Global error handling - must be after all routes and static serving
  app.use(errorMonitor.errorMiddleware());
  
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log the error with more context if not already logged by errorMonitor
    if (!res.headersSent) {
      console.error("Global error handler caught:", {
        message,
        stack: err?.stack,
        url: req.url,
        method: req.method,
        status
      });
      
      // Record the error in our error log system if not already done
      // (errorMonitor middleware might have done it, but if it was skipped or failed)
      recordError({
        level: "error",
        type: "server_runtime",
        message,
        stack: err?.stack,
        module: "express",
        statusCode: typeof status === "number" ? status : 500,
        url: req.url,
        method: req.method,
      });
      
      // Always return JSON response for API routes, or if accepting JSON
      if (req.path.startsWith("/api") || req.headers.accept?.includes("json")) {
        res.status(status).json({ 
          error: {
            code: status,
            message: status >= 500 ? "A server error has occurred" : message
          }
        });
      } else {
        // For non-API routes (e.g. frontend render error), send a simple error page or text
        res.status(status).send(`Error ${status}: ${message}`);
      }
    }
  });

  log(`Server initialization complete in ${Date.now() - initStart}ms`);
  return server;
}

// Check if running directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  startServer().then((server) => {
    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5001 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5001", 10);
    const listenOptions =
      app.get("env") === "development"
        ? { port }
        : {
            port,
            host: "0.0.0.0",
          };
    server.listen(listenOptions, () => {
      log(`serving on port ${port}`);
    });
  });
}

// Export for Vercel
export default app;
export { startServer };
