import { Router } from "express";
import { storage } from "../storage/index.js";

const router = Router();

// Get all users
router.get("/", async (req, res) => {
  if (!req.session.isAuthenticated || req.session.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const users = await storage.getAllUsers();
    // Don't return passwords
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    }));
    res.json(safeUsers);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update user role
router.patch("/:id/role", async (req, res) => {
  if (!req.session.isAuthenticated || req.session.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const { role } = req.body;

  if (!role || !["admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const updatedUser = await storage.updateUserRole(id, role);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true, user: { id: updatedUser.id, role: updatedUser.role } });
  } catch (error) {
    console.error("Failed to update user role:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

// Delete user
router.delete("/:id", async (req, res) => {
  // @ts-ignore
  if (!req.session.isAuthenticated || req.session.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { id } = req.params;

  // Prevent deleting yourself
  // @ts-ignore
  if (req.session.userId === id) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  try {
    await storage.deleteUser(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
