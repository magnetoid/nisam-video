// Admin routes for adding single X (Twitter) videos by URL.
// Mounted at /api/admin/x — all routes require admin auth.

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../storage/index.js";
import { resolveXVideo, extractTweetId } from "../x-resolver.js";
import { generateSlug } from "../utils.js";

const router = Router();

const previewSchema = z.object({
  url: z.string().min(1).max(2000),
});

const createVideoSchema = z.object({
  url: z.string().min(1).max(2000),
  primaryCategoryId: z.string().optional(),
});

// Resolve a tweet URL and return metadata without persisting anything.
// Used by the admin "Add X video" form to preview before committing.
router.post("/preview", requireAuth, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const resolved = await resolveXVideo(parsed.data.url);
    return res.json({
      ok: true,
      tweetId: resolved.videoId,
      permanentUrl: resolved.permanentUrl,
      title: resolved.title,
      description: resolved.description,
      thumbnailUrl: resolved.thumbnailUrl,
      videoUrl: resolved.videoUrl || null,
      durationSeconds: resolved.durationSeconds ?? null,
      publishDate: resolved.publishDate ?? null,
      author: {
        screenName: resolved.authorScreenName ?? null,
        name: resolved.authorName ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve X video";
    return res.status(400).json({ error: message });
  }
});

// Resolve and persist a single X video.
// Upserts a channel for the author so videos are grouped by X handle.
router.post("/videos", requireAuth, async (req, res) => {
  const parsed = createVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const resolved = await resolveXVideo(parsed.data.url);

    const screenName = resolved.authorScreenName?.trim() || `tweet_${resolved.videoId}`;
    const authorUrl = `https://x.com/${screenName}`;

    const channel = await storage.createChannel({
      name: resolved.authorName?.trim() || `@${screenName}`,
      url: authorUrl,
      channelId: screenName,
      thumbnailUrl: null,
      bannerUrl: null,
      platform: "x",
    } as any);

    const slugBase = generateSlug(resolved.title, 80) || `x-video-${resolved.videoId}`;
    const slug = `${slugBase}-${resolved.videoId.slice(-8)}`;

    const video = await storage.createVideo({
      channelId: channel.id,
      videoId: `x_${resolved.videoId}`,
      slug,
      title: resolved.title,
      description: resolved.description,
      thumbnailUrl: resolved.thumbnailUrl,
      duration: resolved.durationSeconds ? String(resolved.durationSeconds) : null,
      viewCount: null,
      publishDate: resolved.publishDate ?? null,
      videoType: "x",
      embedUrl: resolved.videoUrl || resolved.permanentUrl,
      primaryCategoryId: parsed.data.primaryCategoryId ?? null,
    } as any);

    return res.status(201).json({ ok: true, video, channel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add X video";
    const status = /already exists|duplicate/i.test(message) ? 409 : 400;
    return res.status(status).json({ error: message });
  }
});

// Quick URL validation (no network call) for the admin form's onChange.
router.post("/validate-url", requireAuth, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid request body" });
  }
  const tweetId = extractTweetId(parsed.data.url);
  return res.json({ ok: !!tweetId, tweetId });
});

export default router;
