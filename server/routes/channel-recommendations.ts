import { Router } from "express";
import { storage } from "../storage/index.js";
import { insertChannelRecommendationSchema } from "../../shared/schema.js";

function normalizeYouTubeChannelUrl(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  const withScheme = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "youtube.com" && host !== "m.youtube.com") return null;

  const path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") return null;

  if (
    path.startsWith("/watch") ||
    path.startsWith("/shorts") ||
    path.startsWith("/playlist") ||
    path.startsWith("/results")
  ) {
    return null;
  }

  const allowed =
    path.startsWith("/@") ||
    path.startsWith("/channel/") ||
    path.startsWith("/c/") ||
    path.startsWith("/user/");

  if (!allowed) return null;

  return `https://www.youtube.com${path}`;
}

const router = Router();

router.post("/channel-recommendations", async (req, res) => {
  try {
    const parsed = insertChannelRecommendationSchema.parse(req.body);
    const normalized = normalizeYouTubeChannelUrl(parsed.url);
    if (!normalized) {
      return res.status(400).json({ error: "Only YouTube channel URLs are supported" });
    }

    const created = await storage.createChannelRecommendation({
      url: normalized,
      description: parsed.description || null,
      platform: "youtube",
    });

    res.json(created);
  } catch (error) {
    console.error("[channel-recommendations] Create error:", error);
    res.status(400).json({ error: "Failed to submit recommendation" });
  }
});

export default router;

