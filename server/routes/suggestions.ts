import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { activityLogs } from "../../shared/schema.js";
import { recordError } from "../error-log-service.js";

const router = Router();

const suggestionSchema = z.object({
  type: z.enum(["feature", "bug", "channel", "contact"]),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  email: z.string().email().optional(),
});

router.post("/", async (req, res) => {
  try {
    const parsed = suggestionSchema.parse(req.body);

    await db.insert(activityLogs).values({
      action: `suggestion.${parsed.type}`,
      entityType: "suggestion",
      details: JSON.stringify({
        type: parsed.type,
        subject: parsed.subject,
        message: parsed.message,
        email: parsed.email,
      }),
      username: parsed.email || "anonymous",
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid suggestion data", details: error.errors });
    }
    recordError({
      level: "error",
      type: "suggestion_error",
      message: error instanceof Error ? error.message : String(error),
      module: "suggestions",
    });
    res.status(500).json({ error: "Failed to submit suggestion" });
  }
});

export default router;
