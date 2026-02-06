import { Router } from "express";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { tags } from "../../shared/schema.js";

const router = Router();

router.get("/:type", requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const format = (req.query.format as string) || "json";

    let data: any[] = [];
    let filename = "";

    switch (type) {
      case "videos":
        data = await storage.getAllVideos();
        filename = `videos-export-${new Date().toISOString().split("T")[0]}`;
        break;
      case "channels":
        data = await storage.getAllChannels();
        filename = `channels-export-${new Date().toISOString().split("T")[0]}`;
        break;
      case "categories":
        data = await storage.getAllLocalizedCategories('en');
        filename = `categories-export-${new Date().toISOString().split("T")[0]}`;
        break;
      case "tags":
        const allTags = await db.select().from(tags);
        data = allTags;
        filename = `tags-export-${new Date().toISOString().split("T")[0]}`;
        break;
      case "analytics":
        const videos = await storage.getAllVideos();
        data = videos.map((v) => ({
          id: v.id,
          title: v.title,
          channelName: v.channel?.name || "",
          internalViews: v.internalViewsCount,
          likes: v.likesCount,
          publishDate: v.publishDate,
        }));
        filename = `analytics-export-${new Date().toISOString().split("T")[0]}`;
        break;
      default:
        res.status(400).json({ error: "Invalid export type" });
        return;
    }

    if (format === "csv") {
      // Convert to CSV
      if (data.length === 0) {
        res.status(200).send("No data available");
        return;
      }

      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              if (value === null || value === undefined) return "";
              const stringValue = String(value);
              // Escape quotes and wrap in quotes if contains comma or quote
              if (
                stringValue.includes(",") ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
              ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(","),
        ),
      ];

      res.header("Content-Type", "text/csv");
      res.header(
        "Content-Disposition",
        `attachment; filename="${filename}.csv"`,
      );
      res.send(csvRows.join("\n"));
    } else {
      // Return JSON
      res.header("Content-Type", "application/json");
      res.header(
        "Content-Disposition",
        `attachment; filename="${filename}.json"`,
      );
      res.json(data);
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

export default router;
