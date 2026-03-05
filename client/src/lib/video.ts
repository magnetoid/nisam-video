import { getOptimizedImageUrl } from "./image";

/**
 * Get the max resolution thumbnail for a video (usually for hero sections)
 */
export const getMaxResolutionThumbnail = (thumbnailUrl: string, videoId?: string): string => {
  let url = thumbnailUrl;

  // If it's already a maxres URL, keep it
  if (thumbnailUrl.includes('maxresdefault.jpg')) {
    url = thumbnailUrl;
  } 
  // If we have a video ID and it looks like a YouTube ID (11 chars) or the thumbnail is from YouTube
  else if (videoId && (videoId.length === 11 || thumbnailUrl.includes('ytimg') || thumbnailUrl.includes('youtube')) && !thumbnailUrl.includes('tiktok')) {
    url = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }
  // If it's a YouTube URL but no video ID provided, try to upgrade resolution
  else if (thumbnailUrl.includes('i.ytimg.com')) {
    url = thumbnailUrl.replace(/\/(hqdefault|mqdefault|sddefault)\.jpg$/, '/maxresdefault.jpg');
  }
  
  return getOptimizedImageUrl(url, 1280);
};

/**
 * Get an optimized thumbnail for lists/grids (smaller size)
 */
export const getOptimizedThumbnail = (thumbnailUrl: string): string => {
  let url = thumbnailUrl;

  // Convert hqdefault.jpg (480x360) to mqdefault.jpg (320x180) for smaller cards
  if (thumbnailUrl.includes('i.ytimg.com')) {
    url = thumbnailUrl.replace(/\/(hqdefault|maxresdefault|sddefault)\.jpg$/, '/mqdefault.jpg');
  }
  
  return getOptimizedImageUrl(url, 640);
};
