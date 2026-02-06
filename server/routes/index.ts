import { Express } from "express";
import authRouter from "./auth.js";
import channelsRouter from "./channels.js";
import tiktokRouter from "./tiktok.js";
import adminRouter from "./admin.js";
import videosRouter from "./videos.js";
import categoriesRouter from "./categories.js";
import tagsRouter from "./tags.js";
import playlistsRouter from "./playlists.js";
import schedulerRouter from "./scheduler.js";
import automationRouter from "./automation.js";
import analyticsRouter from "./analytics.js";
import systemRouter from "./system.js";
import seoRouter from "./seo.js";
import utilsRouter from "./utils.js";
import shortsRouter from "./shorts.js";
import userRouter from "./user.js";
import logsRouter from "./logs.js";
import exportsRouter from "./exports.js";
import aiSettingsRouter from "./ai-settings.js";
import publicRouter from "./public.js";
import cronRouter from "./cron.js";

export function registerFeatureRoutes(app: Express): void {
  app.use("/api", publicRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/channels", channelsRouter);
  app.use("/api/tiktok-profiles", tiktokRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/videos", videosRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/tags", tagsRouter);
  app.use("/api/playlists", playlistsRouter);
  app.use("/api/scheduler", schedulerRouter);
  app.use("/api/automation", automationRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/system", systemRouter);
  app.use("/api/seo", seoRouter);
  app.use("/api/utils", utilsRouter);
  app.use("/api/shorts", shortsRouter);
  app.use("/api/user", userRouter);
  app.use("/api", logsRouter); // Mounts /client-logs and /activity-logs
  app.use("/api/export", exportsRouter);
  app.use("/api/ai", aiSettingsRouter);
  app.use("/api/cron", cronRouter);
}
