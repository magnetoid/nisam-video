import { useState, memo } from "react";
import { Link } from "wouter";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LikeButton } from "./LikeButton";
import type { VideoWithRelations } from "@shared/schema";

interface VideoCardProps {
  video: VideoWithRelations;
  onClick?: () => void;
  variant?: "carousel" | "grid";
}

const getOptimizedThumbnail = (thumbnailUrl: string): string => {
  // Convert hqdefault.jpg (480x360) to mqdefault.jpg (320x180) for smaller cards
  if (thumbnailUrl.includes('i.ytimg.com')) {
    return thumbnailUrl.replace(/\/(hqdefault|maxresdefault|sddefault)\.jpg$/, '/mqdefault.jpg');
  }
  return thumbnailUrl;
};

export const VideoCard = memo(function VideoCard({ video, onClick, variant = "carousel" }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const widthClass = variant === "grid" 
    ? "w-full" 
    : "w-40 sm:w-56 md:w-64 lg:w-80 flex-shrink-0 snap-start";

  const optimizedThumbnail = getOptimizedThumbnail(video.thumbnailUrl);

  const content = (
    <div
      className={`group relative ${widthClass} cursor-pointer transition-transform duration-300 ease-out`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      data-testid={`card-video-${video.id}`}
      style={{
        transform: isHovered ? "scale(1.05)" : "scale(1)",
        zIndex: isHovered ? 10 : 1,
      }}
    >
      <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
        <img
          src={optimizedThumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
          loading="lazy"
          data-testid="img-thumbnail"
        />

        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            <h3
              className="font-semibold text-base line-clamp-2"
              data-testid="text-title"
            >
              {video.title}
            </h3>

            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <span data-testid="text-channel-name">{video.channel.name}</span>
              {video.viewCount && (
                <>
                  <span>•</span>
                  <span data-testid="text-view-count">{video.viewCount}</span>
                </>
              )}
            </div>

            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {video.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="text-xs px-2 py-0 h-5"
                    data-testid={`badge-tag-${tag.id}`}
                  >
                    {tag.tagName}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {isHovered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-sm rounded-full p-3">
              <Play className="h-8 w-8 text-foreground fill-current" />
            </div>
          </div>
        )}

        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/90 px-2 py-1 rounded text-xs font-medium">
            {video.duration}
          </div>
        )}
      </div>

      {!isHovered && (
        <div className="mt-2 space-y-1">
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
              {video.channel.name}
            </p>
            <LikeButton
              videoId={video.id}
              size="sm"
              variant="ghost"
              showCount={true}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return content;
  }

  return <Link href={`/video/${video.slug || video.id}`}>{content}</Link>;
});
