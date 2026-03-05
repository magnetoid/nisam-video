export function getOptimizedImageUrl(url: string | null | undefined, width = 640): string {
  if (!url) return "/placeholder-image.jpg"; // Default placeholder
  if (url.startsWith("/api/images")) return url;
  if (url.startsWith("data:")) return url;

  // Only proxy external images
  if (url.startsWith("http")) {
    return `/api/images/proxy?url=${encodeURIComponent(url)}&width=${width}`;
  }
  
  return url;
}
