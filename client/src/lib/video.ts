import { getOptimizedImageUrl } from "./image";

/**
 * Get the max resolution thumbnail for a video (usually for hero sections)
 */
export const getMaxResolutionThumbnail = (thumbnailUrl: string, videoId: string): string => {
  let url = thumbnailUrl;

  // If it's already a maxres URL, keep it
  if (thumbnailUrl.includes('maxresdefault.jpg')) {
    url = thumbnailUrl;
  } 
  // If it's a YouTube URL, try to construct the maxres version
  else if (thumbnailUrl.includes('i.ytimg.com') || videoId) {
    url = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }
  
  return getOptimizedImageUrl(url);
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
  
  return getOptimizedImageUrl(url);
};
