import { useRef, useState, useEffect, memo } from "react";
import { VideoCard } from "./VideoCard";
import type { VideoWithRelations } from "@shared/schema";

interface LazyVideoCardProps {
  video: VideoWithRelations;
  variant?: "carousel" | "grid";
}

export const LazyVideoCard = memo(function LazyVideoCard({ video, variant = "carousel" }: LazyVideoCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const widthClass = variant === "grid" ? "w-full" : "w-40 sm:w-56 md:w-64 lg:w-80 flex-shrink-0";

  if (!isVisible) {
    return (
      <div ref={ref} className={`${widthClass} aspect-video bg-muted rounded-md animate-pulse`} />
    );
  }

  return <VideoCard video={video} variant={variant} />;
});
