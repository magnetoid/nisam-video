import { Router } from "express";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function getConfiguredAdmin() {
  if (process.env.NODE_ENV === "production") {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return null;
    }
    return { username: ADMIN_USERNAME, password: ADMIN_PASSWORD };
  }

  return {
    username: ADMIN_USERNAME || "admin",
    password: ADMIN_PASSWORD || "admin",
  };
}

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const configured = getConfiguredAdmin();
    if (!configured) {
      return res
        .status(500)
        .json({ error: "Admin credentials are not configured" });
    }

    if (username === configured.username && password === configured.password) {
      req.session.isAuthenticated = true;
      req.session.username = username;

      req.session.save((err) => {
        if (err) {
          res.status(500).json({ error: "Failed to save session" });
        } else {
          res.json({ success: true, username });
        }
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
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
  });
});

export default router;
