// Admin routes for adding single X (Twitter) videos by URL.
// Mounted at /api/admin/x — gated by requireAdmin.

import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { storage } from "../storage/index.js";
import { db } from "../db.js";
import { activityLogs, type InsertChannel, type InsertVideo } from "../../shared/schema.js";
import { resolveXVideo, extractTweetId } from "../x-resolver.js";
import { generateSlug } from "../utils.js";
import { categorizeVideo } from "../ai-service.js";

const router = Router();

const previewSchema = z.object({
  url: z.string().min(1).max(2000),
});

const createVideoSchema = z.object({
  url: z.string().min(1).max(2000),
  primaryCategoryId: z.string().optional(),
});

// Known-safe resolver errors that may surface to the client. Anything else is a
// 500 with a generic message — we don't want DB or filesystem messages leaking.
const RESOLVER_ERROR_PATTERNS: RegExp[] = [
  /not a valid X post URL/i,
  /does not contain a video/i,
  /Could not load tweet data/i,
  /HLS-only or unsupported/i,
];

function classifyResolverError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : "";
  if (RESOLVER_ERROR_PATTERNS.some((re) => re.test(raw))) {
    return { status: 400, message: raw };
  }
  return { status: 500, message: "Failed to resolve X video" };
}

function normalizeScreenName(raw: string | undefined, fallbackId: string): string {
  const candidate = (raw ?? "").trim();
  return /^[A-Za-z0-9_]{1,15}$/.test(candidate) ? candidate : `tweet_${fallbackId}`;
}

function previewResponse(resolved: Awaited<ReturnType<typeof resolveXVideo>>) {
  return {
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
  };
}

// Resolve a tweet URL and return metadata without persisting anything.
// Used by the admin "Add X video" form to preview before committing.
router.post("/preview", requireAdmin, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const resolved = await resolveXVideo(parsed.data.url);
    return res.json(previewResponse(resolved));
  } catch (error) {
    const { status, message } = classifyResolverError(error);
    if (status === 500) console.error("[x.preview] unexpected error:", error);
    return res.status(status).json({ error: message });
  }
});

// Fire-and-forget category linking. Failure here should not surface to the
// admin — the video is already saved. Mirrors channel-sync.ts behavior.
async function categorizeXVideoInBackground(videoId: string, videoDbId: string) {
  try {
    const video = await storage.getVideo(videoDbId);
    if (!video) return;
    const result = await categorizeVideo(video.title, video.description || "", { timeoutMs: 20000 });
    const categoriesEn = result.categories.en || [];
    const categoriesSr = result.categories.sr || [];
    const max = Math.max(categoriesEn.length, categoriesSr.length);
    for (let i = 0; i < max; i++) {
      const nameEn = categoriesEn[i];
      if (!nameEn) continue;
      const nameSr = categoriesSr[i];
      const categorySlug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let category = await storage.getLocalizedCategoryBySlug(categorySlug, "en");
      if (!category) {
        const translations: Array<{ languageCode: string; name: string; slug: string; description: string | null }> = [
          { languageCode: "en", name: nameEn, slug: categorySlug, description: null },
        ];
        if (nameSr) {
          translations.push({ languageCode: "sr-Latn", name: nameSr, slug: categorySlug, description: null });
        }
        category = await storage.createCategory({}, translations);
      } else if (nameSr) {
        await storage.addCategoryTranslation(category.id, {
          categoryId: category.id,
          languageCode: "sr-Latn",
          name: nameSr,
          slug: categorySlug,
          description: null,
        }).catch(() => undefined);
      }
      await storage.addVideoCategory(videoDbId, category.id);
    }
    console.log(`[x.import] categorized tweet ${videoId} -> video ${videoDbId}`);
  } catch (error) {
    console.error(`[x.import] categorization failed for video ${videoDbId}:`, error);
  }
}

// Resolve and persist a single X video.
// Upserts a channel for the author so videos are grouped by X handle.
router.post("/videos", requireAdmin, async (req, res) => {
  const parsed = createVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  let resolved: Awaited<ReturnType<typeof resolveXVideo>>;
  try {
    resolved = await resolveXVideo(parsed.data.url);
  } catch (error) {
    const { status, message } = classifyResolverError(error);
    if (status === 500) console.error("[x.videos] resolver error:", error);
    return res.status(status).json({ error: message });
  }

  const externalVideoId = `x_${resolved.videoId}`;

  // Idempotency: if we've imported this tweet before, return the existing row
  // instead of attempting an insert that would create an orphan channel on a
  // unique-constraint failure halfway through.
  try {
    const existing = await storage.getVideoByVideoId(externalVideoId);
    if (existing) {
      return res.status(409).json({
        ok: true,
        error: "This X post has already been imported.",
        video: existing,
      });
    }
  } catch (error) {
    console.error("[x.videos] lookup existing video failed:", error);
  }

  const screenName = normalizeScreenName(resolved.authorScreenName, resolved.videoId);
  const authorUrl = `https://x.com/${screenName}`;

  const channelData: InsertChannel = {
    name: resolved.authorName?.trim() || `@${screenName}`,
    url: authorUrl,
    channelId: screenName,
    thumbnailUrl: null,
    bannerUrl: null,
    platform: "x",
  };

  let channel: Awaited<ReturnType<typeof storage.createChannel>>;
  try {
    channel = await storage.createChannel(channelData);
  } catch (error: any) {
    if (error?.code === "23505") {
      // The createChannel helper already handles URL collisions, but a different
      // unique constraint (e.g. channelId) could still throw. Surface clearly.
      return res.status(409).json({ error: "Channel collision — this X handle is already registered with different details." });
    }
    console.error("[x.videos] createChannel failed:", error);
    return res.status(500).json({ error: "Failed to create channel for the X author." });
  }

  const slugBase = generateSlug(resolved.title, 80) || `x-video-${resolved.videoId}`;
  const slug = `${slugBase}-${resolved.videoId.slice(-8)}`;

  const videoData: InsertVideo = {
    channelId: channel.id,
    videoId: externalVideoId,
    slug,
    title: resolved.title,
    description: resolved.description || null,
    thumbnailUrl: resolved.thumbnailUrl,
    duration: resolved.durationSeconds ? String(resolved.durationSeconds) : null,
    viewCount: null,
    publishDate: resolved.publishDate ?? null,
    videoType: "x",
    embedUrl: resolved.videoUrl, // resolver guarantees this is an mp4 URL
    primaryCategoryId: parsed.data.primaryCategoryId ?? null,
  };

  let video: Awaited<ReturnType<typeof storage.createVideo>>;
  try {
    video = await storage.createVideo(videoData);
  } catch (error: any) {
    if (error?.code === "23505") {
      // A concurrent insert won the race. Return the now-existing row.
      const existing = await storage.getVideoByVideoId(externalVideoId).catch(() => undefined);
      if (existing) return res.status(409).json({ ok: true, error: "This X post has already been imported.", video: existing });
      return res.status(409).json({ error: "Duplicate video." });
    }
    console.error("[x.videos] createVideo failed:", error);
    return res.status(500).json({ error: "Failed to create video record." });
  }

  // Audit trail — matches the pattern at server/routes/admin.ts.
  try {
    await db.insert(activityLogs).values({
      action: "x.import_video",
      entityType: "video",
      entityId: video.id,
      username: (req.session as any)?.username ?? "admin",
      ipAddress: req.ip ?? null,
      details: JSON.stringify({ tweetId: resolved.videoId, channelId: channel.id, slug }),
    });
  } catch (error) {
    // Audit-log failures must not block the import; the most common cause is
    // the table not existing yet on fresh installs.
    console.warn("[x.videos] activity log insert failed:", error);
  }

  // Fire-and-forget AI categorization. Failure does not surface to the admin.
  void categorizeXVideoInBackground(resolved.videoId, video.id);

  return res.status(201).json({ ok: true, video, channel });
});

// Quick URL validation (no network call) for the admin form's onChange.
router.post("/validate-url", requireAdmin, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid request body" });
  }
  const tweetId = extractTweetId(parsed.data.url);
  return res.json({ ok: !!tweetId, tweetId });
});

export default router;
