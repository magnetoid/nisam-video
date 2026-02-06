import type { VideoWithLocalizedRelations } from "../shared/schema.js";

export function isShortsChannelUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/shorts(?:\/|$|\?)/i.test(url);
}

export function isEligibleShortsVideo(video: Pick<VideoWithLocalizedRelations, "videoType" | "channel">): boolean {
  if (video.videoType === "tiktok") return true;
  if (video.videoType !== "youtube_short") return false;
  return isShortsChannelUrl(video.channel?.url);
}

