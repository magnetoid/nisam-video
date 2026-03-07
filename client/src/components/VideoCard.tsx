import { useState, memo, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Play } from "lucide-react";
import { LikeButton } from "./LikeButton";
import type { VideoWithRelations } from "@shared/schema";
import { getOptimizedThumbnail } from "@/lib/video";

import { useTranslation } from "react-i18next";

interface VideoCardProps {
  video: VideoWithRelations;
  onClick?: () => void;
  variant?: "carousel" | "grid";
}

export const VideoCard = memo(function VideoCard({ video, onClick, variant = "carousel" }: VideoCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  const widthClass = variant === "grid" 
    ? "w-full" 
    : "w-40 sm:w-56 md:w-64 lg:w-80 flex-shrink-0 snap-start";

  const optimizedThumbnail = imgError ? video.thumbnailUrl : getOptimizedThumbnail(video.thumbnailUrl);

  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Immediate response with 0ms delay
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Add slight delay for smoother leave transition
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 50);
  };

  const content = (
    <div
      className={`group relative ${widthClass} cursor-pointer transition-shadow duration-200 ease-out`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      data-testid={`card-video-${video.id}`}
      style={{
        zIndex: isHovered ? 10 : 1,
      }}
    >
      <div className="relative aspect-video rounded-md overflow-hidden bg-muted group-hover:shadow-lg transition-shadow duration-300">
        {/* Banner Background Layer - Only visible if banner exists */}
        {video.channel?.bannerUrl && (
           <div 
             className="absolute inset-0 z-0 opacity-50 blur-lg scale-110 transition-transform duration-700 group-hover:scale-115"
             style={{
               backgroundImage: `url(${video.channel.bannerUrl})`,
               backgroundSize: 'cover',
               backgroundPosition: 'center',
             }}
           />
        )}
        
        {/* Gradient Overlay for Banner */}
        {video.channel?.bannerUrl && (
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
        )}

        <img
          src={optimizedThumbnail}
          alt={video.title}
          className="w-full h-full object-cover relative z-1 transform-gpu transition-transform duration-300 ease-out group-hover:scale-105"
          loading="lazy"
          data-testid="img-thumbnail"
          onError={() => setImgError(true)}
        />

        <div className="absolute inset-0 z-10 bg-black/0 transition-colors duration-200 group-hover:bg-black/25" />

        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100" />

        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out z-10 ${
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="bg-background/80 backdrop-blur-sm rounded-full p-3 shadow-lg">
            <Play className="h-8 w-8 text-foreground fill-current" />
          </div>
        </div>

        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/90 px-2 py-1 rounded text-xs font-medium z-10">
            {video.duration}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1 relative z-20">
        <h3
          className="font-medium text-sm line-clamp-2"
          data-testid="text-title-static"
        >
          {video.title}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-xs text-muted-foreground"
            data-testid="text-channel-static"
          >
            {video.channel?.name || t('video.unknownChannel', 'Unknown Channel')}
          </p>
          <LikeButton
            videoId={video.id}
            size="sm"
            variant="ghost"
            showCount={true}
          />
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return content;
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return <Link href={`/video/${video.slug || video.id}`} className="block">{content}</Link>;
});
