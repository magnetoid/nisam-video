import express, { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { put } from "@vercel/blob";
import crypto from "crypto";

const router = Router();

function sanitizeFolder(input: string): string {
  const trimmed = input.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  const safe = trimmed.replace(/[^a-zA-Z0-9/_-]+/g, "-");
  return safe.replace(/\/+/, "/");
}

function getFilename(headerValue: unknown): string {
  const name = typeof headerValue === "string" ? headerValue : "upload.bin";
  const base = name.split("/").pop() || "upload.bin";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

router.post(
  "/blob",
  requireAuth,
  express.raw({ type: () => true, limit: "25mb" }),
  async (req, res) => {
    try {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        return res.status(501).json({
          error: "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN.",
        });
      }

      const folderParam = typeof req.query.folder === "string" ? req.query.folder : "";
      const folder = folderParam ? sanitizeFolder(folderParam) : "uploads";
      const originalName = getFilename(req.headers["x-filename"]);
      const key = `${folder}/${crypto.randomUUID()}-${originalName}`;

      const contentType =
        typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined;

      const body = req.body;
      if (!body || !(body instanceof Buffer) || body.length === 0) {
        return res.status(400).json({ error: "Missing file body" });
      }

      const blob = await put(key, body, {
        access: "public",
        contentType,
        token,
      });

      res.json({ url: blob.url, pathname: blob.pathname, size: blob.size, contentType: blob.contentType });
    } catch (error: any) {
      console.error("Blob upload error:", error);
      res.status(500).json({ error: error?.message || "Blob upload failed" });
    }
  },
);

export default router;

