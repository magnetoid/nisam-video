import { Router } from "express";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "magnetoid";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Controlbalanced33101..";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("[LOGIN] Attempt for username:", username);

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.isAuthenticated = true;
      req.session.username = username;
      console.log("[LOGIN] Session before save:", req.session);
      console.log("[LOGIN] Session ID:", req.sessionID);

      req.session.save((err) => {
        if (err) {
          console.error("[LOGIN] Session save error:", err);
          res.status(500).json({ error: "Failed to save session" });
        } else {
          console.log("[LOGIN] Session saved successfully");
          console.log("[LOGIN] Cookie settings:", req.session.cookie);
          res.json({ success: true, username });
        }
      });
    } else {
      console.log("[LOGIN] Invalid credentials");
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("[LOGIN] Login error:", error);
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
  console.log("[SESSION] Check - Session ID:", req.sessionID);
  console.log("[SESSION] Check - Session data:", req.session);
  console.log(
    "[SESSION] Check - isAuthenticated:",
    req.session.isAuthenticated,
  );
  console.log("[SESSION] Check - Cookies:", req.headers.cookie);

  res.json({
    isAuthenticated: req.session.isAuthenticated || false,
    username: req.session.username || null,
  });
});

export default router;
