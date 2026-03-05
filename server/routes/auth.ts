import { Router } from "express";
import bcrypt from "bcrypt";
import { storage } from "../storage/index.js";

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
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      console.warn("[Auth] Using default admin credentials (admin/admin) for development mode.");
    }
    return {
      username: normalizeCredential(ADMIN_USERNAME || "admin"),
      password: normalizeCredential(ADMIN_PASSWORD || "admin"),
    };
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

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await storage.createUser({
      username,
      password: hashedPassword,
      role: "user",
      email: req.body?.email || null,
    });

    req.session.isAuthenticated = true;
    req.session.username = newUser.username;
    // @ts-ignore
    req.session.userId = newUser.id;
    // @ts-ignore
    req.session.role = newUser.role;

    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to save session" });
      } else {
        res.json({ success: true, username: newUser.username, role: newUser.role });
      }
    });

  } catch (error) {
    console.error("[auth] Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = normalizeCredential(req.body?.username);
    const password = normalizeCredential(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // 1. Check Hardcoded Admin first (Environment variables)
    const configured = getConfiguredAdmin();
    if (configured && username === configured.username && password === configured.password) {
      req.session.isAuthenticated = true;
      req.session.username = username;
      // @ts-ignore
      req.session.role = "admin";

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
        req.session.isAuthenticated = true;
        req.session.username = user.username;
        // @ts-ignore
        req.session.userId = user.id;
        // @ts-ignore
        req.session.role = user.role;

        return req.session.save((err) => {
          if (err) {
            res.status(500).json({ error: "Failed to save session" });
          } else {
            res.json({ success: true, username: user.username, role: user.role });
          }
        });
      }
    }

    res.status(401).json({ error: "Invalid credentials" });
  } catch (error) {
    console.error("[auth] Login error:", error);
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
