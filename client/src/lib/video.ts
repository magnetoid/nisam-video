/**
 * Get the max resolution thumbnail for a video (usually for hero sections)
 */
export const getMaxResolutionThumbnail = (thumbnailUrl: string, videoId: string): string => {
  // If it's already a maxres URL, return it
  if (thumbnailUrl.includes('maxresdefault.jpg')) return thumbnailUrl;
  
  // If it's a YouTube URL, try to construct the maxres version
  if (thumbnailUrl.includes('i.ytimg.com') || videoId) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }
  
  return thumbnailUrl;
};

/**
 * Get an optimized thumbnail for lists/grids (smaller size)
 */
export const getOptimizedThumbnail = (thumbnailUrl: string): string => {
  // Convert hqdefault.jpg (480x360) to mqdefault.jpg (320x180) for smaller cards
  if (thumbnailUrl.includes('i.ytimg.com')) {
    return thumbnailUrl.replace(/\/(hqdefault|maxresdefault|sddefault)\.jpg$/, '/mqdefault.jpg');
  }
  return thumbnailUrl;
};
