import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: "Authentication required" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAuthenticated && req.session.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Unauthorized: Admin access required" });
  }
}

export function getUserIdentifier(req: Request): string {
  const fingerprint =
    req.headers["x-fingerprint"] ||
    `${req.ip}-${req.headers["user-agent"] || "unknown"}`;
  return typeof fingerprint === "string" ? fingerprint : fingerprint[0];
}
