import { Router } from "express";
import bcrypt from "bcrypt";
import { storage } from "../storage/index.js";
import { recordAuditLog } from "../error-log-service.js";
import crypto from "crypto";

function normalizeCredential(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function generateRequestId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function sanitizeForLog(value: unknown): string {
  if (typeof value === "string" && value.length > 100) {
    return value.substring(0, 100) + "...";
  }
  return String(value || "");
}

function getConfiguredAdmin() {
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === "production") {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return null;
    }
    return { username: normalizeCredential(ADMIN_USERNAME), password: normalizeCredential(ADMIN_PASSWORD) };
  }

  if (process.env.NODE_ENV === "development") {
    if (ADMIN_USERNAME && ADMIN_PASSWORD) {
      return {
        username: normalizeCredential(ADMIN_USERNAME),
        password: normalizeCredential(ADMIN_PASSWORD),
      };
    }

    const allowDevDefault = process.env.ALLOW_DEV_DEFAULT_ADMIN === "1";
    if (!allowDevDefault) return null;

    console.warn("[Auth] Using default admin credentials (admin/admin) because ALLOW_DEV_DEFAULT_ADMIN=1.");
    return { username: "admin", password: "admin" };
  }

  return null;
}

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const username = normalizeCredential(req.body?.username);
    const password = normalizeCredential(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: "Password must contain uppercase, lowercase, and a number" });
    }

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await storage.createUser({
      username,
      password: hashedPassword,
      role: "user",
      email: req.body?.email || null,
    });

    // Regenerate session to prevent session fixation attacks
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.isAuthenticated = true;
    req.session.username = newUser.username;
    req.session.userId = newUser.id;
    req.session.role = newUser.role;

    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to save session" });
      } else {
        recordAuditLog({
          action: "user.register",
          userId: newUser.id,
          username: newUser.username,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          metadata: { email: newUser.email },
        });
        res.json({ success: true, username: newUser.username, role: newUser.role });
      }
    });

  } catch (error) {
    console.error("[auth] Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const requestId = generateRequestId();
  
  try {
    const username = normalizeCredential(req.body?.username);
    const password = normalizeCredential(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // 1. Check Hardcoded Admin first (Environment variables)
    const configured = getConfiguredAdmin();
    if (configured && username === configured.username && password === configured.password) {
      // Regenerate session to prevent session fixation attacks
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      req.session.isAuthenticated = true;
      req.session.username = username;
      // @ts-ignore
      req.session.role = "admin";

      recordAuditLog({
        action: "auth.login.success",
        username,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        metadata: { method: "admin", requestId },
      });

      return req.session.save((err) => {
        if (err) {
          res.status(500).json({ error: "Failed to save session" });
        } else {
          res.json({ success: true, username, role: "admin" });
        }
      });
    }

    // 2. Check Database User
    const user = await storage.getUserByUsername(username);
    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        // Regenerate session to prevent session fixation attacks
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        req.session.isAuthenticated = true;
        req.session.username = user.username;
        // @ts-ignore
        req.session.userId = user.id;
        // @ts-ignore
        req.session.role = user.role;

        recordAuditLog({
          action: "auth.login.success",
          userId: user.id,
          username: user.username,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          metadata: { method: "database", requestId },
        });

        return req.session.save((err) => {
          if (err) {
            res.status(500).json({ error: "Failed to save session" });
          } else {
            res.json({ success: true, username: user.username, role: user.role });
          }
        });
      }
    }

    // Log failed login attempt
    recordAuditLog({
      action: "auth.login.failure",
      username: sanitizeForLog(username),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: { reason: "invalid_credentials", requestId },
    });

    res.status(401).json({ error: "Invalid credentials" });
  } catch (error) {
    console.error("[auth] Login error:", error);
    recordAuditLog({
      action: "auth.login.error",
      username: sanitizeForLog(req.body?.username),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", async (req, res) => {
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      console.error("[auth] Logout error:", err);
      res.status(500).json({ error: "Logout failed" });
    } else {
      console.log(`[auth] User logged out: ${username}`);
      res.json({ success: true });
    }
  });
});

router.get("/session", async (req, res) => {
  res.json({
    isAuthenticated: req.session.isAuthenticated || false,
    username: req.session.username || null,
    // @ts-ignore
    role: req.session.role || null,
    // @ts-ignore
    userId: req.session.userId || null,
  });
});

export default router;
