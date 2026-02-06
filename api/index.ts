import app, { startServer } from "../server/index.js";

// Cache the initialization
let isInitialized = false;

export default async function (req: any, res: any) {
  try {
    const requestUrl = typeof req?.url === "string" ? req.url : "";
    const url = new URL(requestUrl, "http://localhost");
    if (url.pathname === "/api/index") {
      const routedPath = url.searchParams.get("path");
      if (routedPath) {
        url.searchParams.delete("path");
        const query = url.searchParams.toString();
        req.url = `/api/${routedPath}${query ? `?${query}` : ""}`;
      }
    }
  } catch {
    // ignore URL parsing issues
  }

  if (!isInitialized) {
    const initStart = Date.now();
    console.log(`[vercel] Starting initialization...`);
    
    try {
      // Check DB readiness before full init (early exit if DB unavailable)
      const { isDbReady } = await import("../server/db.js");
      if (!isDbReady()) {
        console.warn("[vercel] Database not ready, returning 503");
        return res.status(503).json({ message: "Service temporarily unavailable - database initializing" });
      }
      
      // Phase 1: Register routes
      console.log("[vercel] Phase 1: Registering routes...");
      const { registerRoutes } = await import("../server/routes.js");
      await registerRoutes(app);
      console.log(`[vercel] Phase 1 complete in ${Date.now() - initStart}ms`);
      
      // Phase 2: Full server start (includes middleware, static, etc.)
      console.log("[vercel] Phase 2: Starting server...");
      const { startServer } = await import("../server/index.js");
      await startServer(); // This now has internal logging
      console.log(`[vercel] Phase 2 complete in ${Date.now() - initStart}ms`);
      
      // Final DB check post-init
      if (!isDbReady()) {
        throw new Error("Database failed to initialize after server start");
      }
      
      isInitialized = true;
      console.log(`[vercel] Initialization complete in ${Date.now() - initStart}ms`);
    } catch (e) {
      console.error("[vercel] Failed to initialize serverless function:", e);
      return res.status(503).json({ 
        message: "Server initialization failed - please try again shortly",
        error: process.env.NODE_ENV === 'development' ? e.message : undefined 
      });
    }
  }
  
  // If init succeeded, handle the request
  try {
    app(req, res);
  } catch (reqErr) {
    console.error("[vercel] Request handling error:", reqErr);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal request error" });
    }
  }
}
