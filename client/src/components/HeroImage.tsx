import { useHeroImage } from "@/hooks/useHeroImage";

interface HeroImageProps {
  thumbnailUrl: string;
  videoId: string;
  alt: string;
  className?: string;
}

export function HeroImage({ thumbnailUrl, videoId, alt, className = "" }: HeroImageProps) {
  const { imageUrl, onImageError } = useHeroImage({ thumbnailUrl, videoId });

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
      {...{ fetchpriority: "high" }}
      loading="eager"
      data-testid="img-hero"
      onError={onImageError}
    />
  );
}