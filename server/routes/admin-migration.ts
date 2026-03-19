import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { adminMigrationService } from "../services/admin-migration.js";

const router = Router();

router.use(requireAdmin);

router.get("/preflight", async (_req, res) => {
  try {
    const result = await adminMigrationService.preflight();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ? String(e.message) : "Preflight failed" });
  }
});

router.post("/preflight", async (_req, res) => {
  try {
    const result = await adminMigrationService.preflight();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ? String(e.message) : "Preflight failed" });
  }
});

router.post("/start", async (req, res) => {
  const schema = z.object({
    mode: z.enum(["full", "incremental"]),
    confirmText: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const result = adminMigrationService.start({
    mode: parsed.data.mode,
    confirmText: parsed.data.confirmText,
    startedBy: req.session?.username || req.sessionID || "admin",
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ jobId: result.jobId });
});

router.get("/jobs/:jobId", (req, res) => {
  const job = adminMigrationService.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    jobId: job.jobId,
    state: job.state,
    phase: job.phase,
    progressPct: job.progressPct,
    counters: job.counters,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    errorMessage: job.errorMessage,
    logs: job.logs,
  });
});

router.post("/cutover", async (req, res) => {
  const schema = z.object({
    jobId: z.string(),
    confirmText: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const result = await adminMigrationService.cutover(parsed.data);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

router.post("/rollback", async (req, res) => {
  const schema = z.object({
    reason: z.string().min(1),
    confirmText: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const result = await adminMigrationService.rollback(parsed.data);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

export default router;
