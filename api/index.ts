import app, { startServer } from "../server/index.js";

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
  }

  if (!isInitialized) {
    try {
      await startServer();
      isInitialized = true;
    } catch (e: any) {
      console.error("[vercel] init failed:", e);
      return res.status(503).json({ 
        message: "Server initialization failed",
        error: process.env.NODE_ENV === 'development' ? e.message : undefined 
      });
    }
  }

  try {
    app(req, res);
  } catch (reqErr) {
    console.error("[vercel] request error:", reqErr);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal request error" });
    }
  }
}
