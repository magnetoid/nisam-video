import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import compression from "compression";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./scheduler";
import { cacheMiddleware } from "./cache-middleware";
import { storage } from "./storage";

const app = express();

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
    secure: true, // Always use secure cookies for HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    sameSite: "lax",
  },
};

if (process.env.NODE_ENV === "production") {
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
  // Admin and auth API routes should not be cached
  else if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/auth")) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
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

// API caching middleware for public GET endpoints
app.use(cacheMiddleware());

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
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize scheduler
  await scheduler.init();

  // Warm cache on startup to eliminate cold-start delays
  log("Warming cache...");
  await Promise.all([
    storage.getSeoSettings(),
    storage.getAllCategories(),
    storage.getRecentVideos(10),
  ]).catch((err) => log(`Cache warming failed: ${err.message}`));
  log("Cache warmed successfully");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Error handler caught:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
