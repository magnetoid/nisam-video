import "dotenv/config"; // Ensure env vars are loaded first
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import compression from "compression";
import connectPgSimple from "connect-pg-simple";
import { pool, isDbReady } from "./db.js";
import { registerRoutes } from "./routes.js";
import publicRoutes from "./routes/public.js";
import { scheduler } from "./scheduler.js";
import { cacheMiddleware } from "./cache-middleware.js";
import { storage } from "./storage/index.js";
import { fileURLToPath } from "url";
import { errorMonitor, asyncHandler } from "./error-monitor.js";
import { recordError } from "./error-log-service.js";
import { recordRequestMetric } from "./performance-metrics.js";

const app = express();

process.on("unhandledRejection", (reason: any) => {
  recordError({
    level: "critical",
    type: "unhandled_rejection",
    message: reason?.message || String(reason),
    stack: reason?.stack,
    module: "process",
  });
});

process.on("uncaughtException", (error: any) => {
  recordError({
    level: "critical",
    type: "uncaught_exception",
    message: error?.message || String(error),
    stack: error?.stack,
    module: "process",
  });
});

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
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Trust proxy for Cloudflare and other reverse proxies
// Cloudflare sets CF-Connecting-IP header
app.set("trust proxy", true);

declare module "express-session" {
  interface SessionData {
    isAuthenticated?: boolean;
    username?: string;
  }
}

const PgStore = connectPgSimple(session);

const sessionConfig: session.SessionOptions = {
  secret:
    process.env.SESSION_SECRET || "nisam-video-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    sameSite: "lax",
  },
};

if (process.env.NODE_ENV === "production" && pool) {
  sessionConfig.store = new PgStore({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  });
}

app.use(session(sessionConfig));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

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

  // Security headers for Cloudflare
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

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

// Global error handler - moved to top level for early catching
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error("Error handler caught:", err);
  recordError({
    level: "error",
    type: "server_runtime",
    message,
    stack: err?.stack,
    module: "express",
    statusCode: typeof status === "number" ? status : 500,
  });
  res.status(status).json({ message });
});

// Create startup function
async function startServer() {
  const initStart = Date.now();
  log("Starting server initialization...");

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
    const dbStatus = {
      ready: isDbReady(),
      pool: pool ? 'connected' : 'disconnected',
    };
    
    res.json({
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      errorMonitor: healthStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  // Error monitoring middleware (must be added after routes)
  app.use(errorMonitor.errorMiddleware());

  // Initialize scheduler (only if not in serverless/production to avoid background tasks issues)
  if (process.env.NODE_ENV !== "production") {
    log("Initializing scheduler...");
    const schedStart = Date.now();
    await scheduler.init();
    log(`Scheduler initialized in ${Date.now() - schedStart}ms`);
  }

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
    log("Setting up Vite dev server...");
    const viteStart = Date.now();
    const { setupVite } = await import("./vite-dev.js");
    await setupVite(app, server);
    log(`Vite setup completed in ${Date.now() - viteStart}ms`);
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
            reusePort: true,
          };
    server.listen(listenOptions, () => {
      log(`serving on port ${port}`);
    });
  });
}

// Export for Vercel
export default app;
export { startServer };
