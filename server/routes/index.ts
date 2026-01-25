import { Express } from "express";
import authRouter from "./auth";
import channelsRouter from "./channels";
import tiktokRouter from "./tiktok";
import videosRouter from "./videos";
import adminRouter from "./admin";

export function registerFeatureRoutes(app: Express): void {
  app.use("/api/auth", authRouter);
  app.use("/api/channels", channelsRouter);
  app.use("/api/tiktok-profiles", tiktokRouter);
  app.use("/api/videos", videosRouter);
  app.use("/api/admin", adminRouter);
}
