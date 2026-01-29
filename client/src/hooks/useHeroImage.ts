import { useState } from "react";
import { getMaxResolutionThumbnail } from "@/lib/video";

interface UseHeroImageOptions {
  thumbnailUrl: string;
  videoId: string;
}

export function useHeroImage({ thumbnailUrl, videoId }: UseHeroImageOptions) {
  const [imgError, setImgError] = useState(false);

  const heroImageUrl = imgError 
    ? thumbnailUrl 
    : getMaxResolutionThumbnail(thumbnailUrl, videoId);

  const handleImageError = () => {
    setImgError(true);
  };

  return {
    imageUrl: heroImageUrl,
    hasError: imgError,
    onImageError: handleImageError,
  };
}