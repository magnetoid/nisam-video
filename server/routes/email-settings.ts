import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage/index.js";
import { insertEmailSettingsSchema } from "../../shared/schema.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const existing = await storage.getEmailSettings();
    const settings = existing || (await storage.updateEmailSettings({}));
    res.json({
      ...settings,
      smtpPassword: settings.smtpPassword ? "********" : null,
      imapPassword: settings.imapPassword ? "********" : null,
    });
  } catch (error) {
    console.error("[email-settings] Get error:", error);
    res.status(500).json({ error: "Failed to fetch email settings" });
  }
});

router.patch("/", requireAuth, async (req, res) => {
  try {
    const parsed = insertEmailSettingsSchema.partial().parse(req.body);
    const existing = await storage.getEmailSettings();

    const update: Record<string, any> = { ...parsed };

    if (parsed.smtpPassword === "********") {
      delete update.smtpPassword;
    }
    if (parsed.imapPassword === "********") {
      delete update.imapPassword;
    }

    if (!existing) {
      const created = await storage.updateEmailSettings(update);
      return res.json({
        ...created,
        smtpPassword: created.smtpPassword ? "********" : null,
        imapPassword: created.imapPassword ? "********" : null,
      });
    }

    const merged: any = {
      ...update,
    };

    const updated = await storage.updateEmailSettings(merged);
    res.json({
      ...updated,
      smtpPassword: updated.smtpPassword ? "********" : null,
      imapPassword: updated.imapPassword ? "********" : null,
    });
  } catch (error) {
    console.error("[email-settings] Update error:", error);
    res.status(400).json({ error: "Failed to update email settings" });
  }
});

export default router;

