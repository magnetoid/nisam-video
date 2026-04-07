import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage/index.js";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await storage.getSystemSettings();

    // If Turnstile is not enabled, skip verification
    if (!settings || !settings.turnstileEnabled || !settings.turnstileSecretKey) {
      return next();
    }

    const token = req.body?.turnstileToken;
    if (!token) {
      return res.status(400).json({
        error: "Turnstile verification required",
        code: "TURNSTILE_MISSING",
      });
    }

    const ip = req.ip || req.headers["x-forwarded-for"] || "";

    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: settings.turnstileSecretKey,
        response: token,
        remoteip: typeof ip === "string" ? ip : Array.isArray(ip) ? ip[0] : "",
      }),
    });

    const result = await verifyResponse.json() as { success: boolean; "error-codes"?: string[] };

    if (!result.success) {
      console.warn("[Turnstile] Verification failed:", result["error-codes"]);
      return res.status(403).json({
        error: "Turnstile verification failed. Please try again.",
        code: "TURNSTILE_FAILED",
      });
    }

    // Verification passed
    next();
  } catch (error) {
    console.error("[Turnstile] Verification error:", error);
    // On verification service error, allow the request through
    // (fail-open to prevent lockout if Cloudflare is down)
    next();
  }
}
