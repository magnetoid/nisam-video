import { Express } from "express";
import authRouter from "./auth.js";
import channelsRouter from "./channels.js";
import tiktokRouter from "./tiktok.js";
import videosRouter from "./videos.js";
import adminRouter from "./admin.js";
import categoriesRouter from "./categories.js";

export function registerFeatureRoutes(app: Express): void {
  app.use("/api/auth", authRouter);
  app.use("/api/channels", channelsRouter);
  app.use("/api/tiktok-profiles", tiktokRouter);
  app.use("/api/videos", videosRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/admin", adminRouter);
}
