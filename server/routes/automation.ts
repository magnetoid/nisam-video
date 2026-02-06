import { Router } from "express";
import { z } from "zod";
import { scheduler } from "../scheduler.js";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage/index.js";
import { jobQueue } from "../services/job-queue.js";
import { db } from "../db.js";
import { scrapeJobs } from "../../shared/schema.js";
import { desc, eq } from "drizzle-orm";

const router = Router();

// Start a new automation job
router.post("/jobs/start", requireAuth, async (req, res) => {
  try {
    const startSchema = z.object({
      type: z.enum(["full_sync", "channel_scan", "scheduler_incremental"]).default("full_sync"),
      targetId: z.string().optional(),
      incremental: z.boolean().default(true),
    });
    const { type, targetId, incremental } = startSchema.parse(req.body);
    const jobId = await jobQueue.createJob(type, targetId, incremental);
    res.json({ success: true, jobId, message: "Job started successfully" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error);
      return res.status(400).json({ error: "Invalid input", code: "VALIDATION_ERROR", details: error.errors });
    }
    console.error("Start job error:", error);
    res.status(500).json({ error: error.message || "Failed to start job", code: "JOB_START_FAILED" });
  }
});

// Get recent jobs status
router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string)?.trim() || '';
    const status = req.query.status as string || '';
    const dateFrom = req.query.dateFrom as string || '';
    const dateTo = req.query.dateTo as string || '';

    let query = db.select().from(scrapeJobs).orderBy(desc(scrapeJobs.startedAt));

    if (search) {
      query = query.where(sql`${scrapeJobs.type} ilike ${`%${search}%`} or ${scrapeJobs.currentChannelName} ilike ${`%${search}%`}`);
    }
    if (status && status !== 'all') {
      query = query.where(eq(scrapeJobs.status, status));
    }
    if (dateFrom) {
      query = query.where(sql`${scrapeJobs.startedAt} >= ${new Date(dateFrom)}`);
    }
    if (dateTo) {
      query = query.where(sql`${scrapeJobs.startedAt} <= ${new Date(dateTo)}`);
    }

    const [jobs, total] = await Promise.all([
      query.limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(scrapeJobs).where(sql`1=1`) // Simplified total; add filters if needed
    ]);
    res.json({ jobs, total: total[0]?.count || 0 });
  } catch (error: any) {
    console.error("Get jobs error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch jobs", code: "JOBS_FETCH_FAILED" });
  }
});

router.get("/jobs/active", requireAuth, async (req, res) => {
  try {
    const job = await storage.getActiveScrapeJob();
    res.json(job || null);
  } catch (error: any) {
    console.error("Get active job error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch active job", code: "ACTIVE_JOB_FETCH_FAILED" });
  }
});

function writeSseEvent(res: any, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  console.log(`SSE emitted: ${event}`, data);
}

async function getJobById(jobId: string) {
  const [job] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, jobId)).limit(1);
  return job || null;
}

router.get("/jobs/:id/stream", requireAuth, async (req, res) => {
  const jobId = req.params.id;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let lastSnapshot = "";
  let lastLogIndex = 0;
  let initialized = false;

  const sendSnapshotIfChanged = (job: any) => {
    const { logs, ...snapshot } = job || {};
    const next = JSON.stringify(snapshot);
    if (next !== lastSnapshot) {
      lastSnapshot = next;
      writeSseEvent(res, "snapshot", snapshot);
    }
  };

  const tick = async () => {
    try {
      const job = await getJobById(jobId);
      if (!job) {
        writeSseEvent(res, "end", { jobId });
        res.end();
        return;
      }

      const logs: any[] = Array.isArray((job as any).logs) ? (job as any).logs : [];
    const prevStatus = lastSnapshot ? JSON.parse(lastSnapshot).status : null;
    sendSnapshotIfChanged(job);

    if (job.status === 'completed' || job.status === 'failed') {
      if (prevStatus !== job.status) {
        writeSseEvent(res, "job_complete", { jobId, status: job.status });
      }
    }

    if (!initialized) {
      const initLogs = logs.slice(Math.max(0, logs.length - 200));
      writeSseEvent(res, "logs_init", { entries: initLogs });
      lastLogIndex = logs.length;
      initialized = true;
      return;
    }

    if (logs.length > lastLogIndex) {
      const entries = logs.slice(lastLogIndex);
      lastLogIndex = logs.length;
      writeSseEvent(res, "log", { entries });
    }
    } catch (e) {
      console.error('Tick error:', e);
      writeSseEvent(res, "error", { message: e.message || 'tick_error', code: 'INTERNAL' });
    }
  };

  const interval = setInterval(() => {
    tick();
  }, 1000);

  const ping = setInterval(() => {
    writeSseEvent(res, "ping", {});
  }, 15000);

  req.on("close", () => {
    clearInterval(interval);
    clearInterval(ping);
  });

  tick().catch((e) => {
    writeSseEvent(res, "error", { message: e?.message || "stream_error" });
  });
});

router.get("/jobs/active/stream", requireAuth, async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let activeJobId: string | null = null;
  let lastSnapshot = "";
  let lastLogIndex = 0;
  let initialized = false;

  const sendSnapshotIfChanged = (job: any) => {
    const { logs, ...snapshot } = job || {};
    const next = JSON.stringify(snapshot);
    if (next !== lastSnapshot) {
      lastSnapshot = next;
      writeSseEvent(res, "snapshot", snapshot);
    }
  };

  const tick = async () => {
    try {
      const activeJob = await storage.getActiveScrapeJob();
      if (!activeJob) {
        if (activeJobId !== null) {
          activeJobId = null;
          lastSnapshot = "";
          lastLogIndex = 0;
          initialized = false;
        }
        writeSseEvent(res, "idle", {});
        return;
      }

      if (activeJobId !== activeJob.id) {
        activeJobId = activeJob.id;
        lastSnapshot = "";
        lastLogIndex = 0;
        initialized = false;
        writeSseEvent(res, "job_changed", { jobId: activeJob.id });
      }

      const job = await getJobById(activeJob.id);
      if (!job) return;

      const logs: any[] = Array.isArray((job as any).logs) ? (job as any).logs : [];
    const prevStatus = activeJobId ? (lastSnapshot ? JSON.parse(lastSnapshot).status : null) : null;
    sendSnapshotIfChanged(job);

    if (job && (job.status === 'completed' || job.status === 'failed')) {
      if (prevStatus !== job.status && prevStatus !== 'running') {
        writeSseEvent(res, "job_complete", { jobId: activeJobId, status: job.status });
      }
    }

    if (!initialized) {
      const initLogs = logs.slice(Math.max(0, logs.length - 200));
      writeSseEvent(res, "logs_init", { entries: initLogs });
      lastLogIndex = logs.length;
      initialized = true;
      return;
    }

    if (logs.length > lastLogIndex) {
      const entries = logs.slice(lastLogIndex);
      lastLogIndex = logs.length;
      writeSseEvent(res, "log", { entries });
    }
    } catch (e) {
      console.error('Active tick error:', e);
      writeSseEvent(res, "error", { message: e.message || 'tick_error', code: 'INTERNAL' });
    }
  };

  const interval = setInterval(() => {
    tick();
  }, 1000);

  const ping = setInterval(() => {
    writeSseEvent(res, "ping", {});
  }, 15000);

  req.on("close", () => {
    clearInterval(interval);
    clearInterval(ping);
  });

  tick().catch((e) => {
    writeSseEvent(res, "error", { message: e?.message || "stream_error" });
  });
});

// Get automation statistics
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const period = parseInt(req.query.period as string) || 30; // days
    const allVideos = await storage.getAllVideos();
    const allChannels = await storage.getAllChannels();
    
    const totalVideos = allVideos.length;
    const videosWithAI = allVideos.filter(video => 
      video.categories && video.categories.length > 0 && 
      video.tags && video.tags.length > 0
    ).length;
    
    const totalChannels = allChannels.length;
    const thirtyDaysAgo = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const activeChannels = allChannels.filter(channel => 
      channel.lastScraped && new Date(channel.lastScraped) > thirtyDaysAgo
    ).length;
    
    // Get last scrape time from most recently scraped channel
    const lastScrapeTime = allChannels
      .filter(channel => channel.lastScraped)
      .sort((a, b) => new Date(b.lastScraped!).getTime() - new Date(a.lastScraped!).getTime())[0]?.lastScraped || null;
    
    // Get last AI processing time from most recently updated video with AI
    const lastAIProcessing = allVideos
      .filter(video => video.categories && video.categories.length > 0 && video.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt || null;

    const stats = {
      totalVideos,
      videosWithAI,
      videosWithoutAI: totalVideos - videosWithAI,
      totalChannels,
      activeChannels,
      lastScrapeTime,
      lastAIProcessing
    };

    res.json(stats);
  } catch (error: any) {
    console.error("Get automation stats error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch automation statistics", code: "STATS_FETCH_FAILED" });
  }
});

// Get activity logs
router.get("/activity", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    // This is a simplified version - in a real implementation, you'd want to store
    // actual activity logs in a database table
    const recentVideos = await storage.getAllVideos();
    const recentVideosLimited = recentVideos.slice(offset, offset + limit);

    const activityLogs = recentVideosLimited.map((video: any, index: number) => {
      const hasAI = video.categories && video.categories.length > 0 && video.tags && video.tags.length > 0;
      return {
        id: video.id,
        type: hasAI ? "ai" : "scrape",
        message: hasAI 
          ? `AI processed: "${video.title}"`
          : `Scraped: "${video.title}" from ${video.channel?.name || 'Unknown Channel'}`,
        timestamp: video.createdAt,
        status: hasAI ? "success" : "info"
      };
    });

    res.json(activityLogs);
  } catch (error: any) {
    console.error("Get activity logs error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch activity logs", code: "ACTIVITY_FETCH_FAILED" });
  }
});

// Export automation data
router.get("/export", requireAuth, async (req, res) => {
  try {
    const { format = "json" } = req.query;
    const exportSchema = z.object({
      format: z.enum(["json", "csv"]).default("json"),
    });
    exportSchema.parse({ format });
    
    const videos = await storage.getAllVideos();
    const channels = await storage.getAllChannels();
    
    // Group videos by category and tags for analytics
    const categoryCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    
    videos.forEach(video => {
      if (video.categories && video.categories.length > 0) {
        video.categories.forEach(cat => {
          categoryCounts[cat.name] = (categoryCounts[cat.name] || 0) + 1;
        });
      }
      if (video.tags && video.tags.length > 0) {
        video.tags.forEach(tag => {
          tagCounts[tag.tagName] = (tagCounts[tag.tagName] || 0) + 1;
        });
      }
    });
    
    const categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    
    const tags = Object.entries(tagCounts)
      .map(([tagName, count]) => ({ tagName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const exportData = {
      exportDate: new Date().toISOString(),
      summary: {
        totalVideos: videos.length,
        totalChannels: channels.length,
        totalCategories: categories.length,
        totalTags: tags.length
      },
      videos: videos.slice(0, 1000), // Limit for export
      channels,
      categories,
      tags
    };

    if (format === "csv") {
      // Convert to CSV format
      const csvHeaders = "ID,Title,URL,Categories,Tags,Channel,Channel URL,Created At\n";
      const csvRows = videos.slice(0, 1000).map((video: any) => {
        const categories = video.categories?.map((c: any) => c.name).join(', ') || '';
        const tags = video.tags?.map((t: any) => t.tagName).join(', ') || '';
        const channelName = video.channel?.name || '';
        const channelUrl = video.channel?.url || '';
        return `"${video.id}","${video.title.replace(/"/g, '""')}","${video.url}","${categories}","${tags}","${channelName}","${channelUrl}","${video.createdAt}"`;
      }).join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=automation-export.csv");
      res.send(csvHeaders + csvRows);
    } else {
      // Default JSON format
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=automation-export.json");
      res.json(exportData);
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error("Export validation error:", error);
      return res.status(400).json({ error: "Invalid export parameters", code: "VALIDATION_ERROR", details: error.errors });
    }
    console.error("Export automation data error:", error);
    res.status(500).json({ error: error.message || "Failed to export automation data", code: "EXPORT_FAILED" });
  }
});

// Health check endpoint
router.get("/health", requireAuth, async (req, res) => {
  try {
    const activeJobs = await db.select({ count: sql<number>`count(*)` }).from(scrapeJobs).where(eq(scrapeJobs.status, "running"));
    const activeCount = activeJobs[0]?.count || 0;
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      activeJobs: activeCount,
      uptime: process.uptime()
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    res.status(500).json({ error: error.message || "Health check failed", code: "HEALTH_CHECK_FAILED" });
  }
});

// Bulk operations
router.post("/jobs/bulk/retry", requireAuth, async (req, res) => {
  try {
    const bulkSchema = z.object({
      ids: z.array(z.string()).min(1),
    });
    const { ids } = bulkSchema.parse(req.body);

    const updated = await db.update(scrapeJobs)
      .set({ status: "pending", transitioning: true, errorMessage: null })
      .where(sql`${scrapeJobs.id} = any(${ids}) and ${scrapeJobs.status} = 'failed'`)
      .returning();

    // Trigger queue processing
    jobQueue.processQueue();

    res.json({ success: true, retried: updated.length, message: `Retried ${updated.length} failed jobs` });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid bulk retry request", code: "VALIDATION_ERROR", details: error.errors });
    }
    console.error("Bulk retry error:", error);
    res.status(500).json({ error: error.message || "Failed to retry jobs", code: "BULK_RETRY_FAILED" });
  }
});

router.delete("/jobs/bulk", requireAuth, async (req, res) => {
  try {
    const bulkSchema = z.object({
      ids: z.array(z.string()).min(1),
    });
    const { ids } = bulkSchema.parse(req.body);

    // Soft delete: set deletedAt
    await db.update(scrapeJobs)
      .set({ status: "cancelled", deletedAt: new Date() })
      .where(sql`${scrapeJobs.id} = any(${ids})`);

    res.json({ success: true, deleted: ids.length, message: `Deleted ${ids.length} jobs` });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid bulk delete request", code: "VALIDATION_ERROR", details: error.errors });
    }
    console.error("Bulk delete error:", error);
    res.status(500).json({ error: error.message || "Failed to delete jobs", code: "BULK_DELETE_FAILED" });
  }
});

router.post("/jobs/:id/pause", requireAuth, async (req, res) => {
  try {
    const jobId = req.params.id;
    await db.update(scrapeJobs)
      .set({ status: "cancelled", transitioning: false })
      .where(eq(scrapeJobs.id, jobId) and eq(scrapeJobs.status, "running"));
    res.json({ success: true, message: "Job paused" });
  } catch (error: any) {
    console.error("Pause job error:", error);
    res.status(500).json({ error: error.message || "Failed to pause job", code: "PAUSE_JOB_FAILED" });
  }
});

router.delete("/jobs/:id", requireAuth, async (req, res) => {
  try {
    const jobId = req.params.id;
    await db.update(scrapeJobs)
      .set({ status: "cancelled", deletedAt: new Date() })
      .where(eq(scrapeJobs.id, jobId));
    res.json({ success: true, message: "Job deleted" });
  } catch (error: any) {
    console.error("Delete job error:", error);
    res.status(500).json({ error: error.message || "Failed to delete job", code: "DELETE_JOB_FAILED" });
  }
});

router.post("/jobs/:id/retry", requireAuth, async (req, res) => {
  try {
    const jobId = req.params.id;
    const [updated] = await db.update(scrapeJobs)
      .set({ status: "pending", transitioning: true, errorMessage: null })
      .where(eq(scrapeJobs.id, jobId) and eq(scrapeJobs.status, "failed"))
      .returning();
    if (updated) {
      jobQueue.processQueue();
      res.json({ success: true, message: "Job retried" });
    } else {
      res.status(400).json({ error: "Job not failed or not found", code: "RETRY_NOT_APPLICABLE" });
    }
  } catch (error: any) {
    console.error("Retry job error:", error);
    res.status(500).json({ error: error.message || "Failed to retry job", code: "RETRY_JOB_FAILED" });
  }
});

// Analytics endpoint
router.get("/analytics", requireAuth, async (req, res) => {
  try {
    const periodDays = parseInt(req.query.period as string) || 7;
    const thirtyDaysAgo = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const analytics = await db.execute(sql`
      SELECT 
        date_trunc('day', startedAt) as date,
        COUNT(*) as jobCount,
        SUM(videosAdded) as totalVideosAdded,
        SUM(failedItems) as totalErrors,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedJobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failedJobs
      FROM scrape_jobs 
      WHERE startedAt >= ${thirtyDaysAgo} AND deletedAt IS NULL
      GROUP BY date_trunc('day', startedAt)
      ORDER BY date DESC
    `);

    const data = (analytics.rows as any[]).map(row => ({
      date: row.date.toISOString().split('T')[0],
      jobCount: row.jobcount,
      totalVideosAdded: parseInt(row.totalvideosadded || 0),
      totalErrors: parseInt(row.totalerrors || 0),
      completedJobs: parseInt(row.completedjobs || 0),
      failedJobs: parseInt(row.failedjobs || 0),
    }));

    res.json({ periodDays, data });
  } catch (error: any) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch analytics", code: "ANALYTICS_FETCH_FAILED" });
  }
});

// Scheduler settings
router.get("/scheduler", requireAuth, async (req, res) => {
  try {
    const settings = await storage.getSchedulerSettings();
    const status = scheduler.getStatus();
    res.json({ ...settings, ...status });
  } catch (error: any) {
    console.error("Get scheduler error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scheduler", code: "SCHEDULER_FETCH_FAILED" });
  }
});

// Update scheduler config
router.post("/scheduler/config", requireAuth, async (req, res) => {
  try {
    const configSchema = z.object({
      intervalHours: z.number().min(1).max(24),
      timezone: z.string().min(2).max(50),
    });
    const { intervalHours, timezone } = configSchema.parse(req.body);

    await scheduler.updateSettings({ intervalHours, timezone });
    await scheduler.stop();
    await scheduler.start();

    res.json({ success: true, message: "Scheduler config updated" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid config", code: "VALIDATION_ERROR", details: error.errors });
    }
    console.error("Update scheduler config error:", error);
    res.status(500).json({ error: error.message || "Failed to update scheduler", code: "SCHEDULER_UPDATE_FAILED" });
  }
});

export default router;
