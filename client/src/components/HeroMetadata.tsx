import { formatViewCount, formatTimeAgo } from "@/lib/formatters";
import type { VideoWithRelations } from "@shared/schema";

interface HeroMetadataProps {
  video: VideoWithRelations;
}

export function HeroMetadata({ video }: HeroMetadataProps) {
  return (
    <div className="flex items-center gap-3 text-sm text-foreground/80">
      <span data-testid="text-channel">{video.channel.name}</span>
      {video.viewCount && (
        <>
          <span>•</span>
          <span data-testid="text-views">{formatViewCount(video.viewCount)}</span>
        </>
      )}
      {video.publishDate && (
        <>
          <span>•</span>
          <span data-testid="text-date">{formatTimeAgo(video.publishDate)}</span>
        </>
      )}
    </div>
  );
}