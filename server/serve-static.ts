import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { seoMiddleware } from "./seo-middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist");
  const indexPath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // Use SEO middleware for HTML injection
  app.use("*", (req, res, next) => {
    seoMiddleware(req, res, next, indexPath).catch(err => {
      console.error("SEO Middleware failed in serveStatic:", err);
      res.sendFile(indexPath);
    });
  });
}
