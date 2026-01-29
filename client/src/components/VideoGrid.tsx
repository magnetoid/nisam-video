import { LazyVideoCard } from "./LazyVideoCard";
import type { VideoWithRelations } from "@shared/schema";

interface VideoGridProps {
  videos: VideoWithRelations[];
  title?: string;
}

export function VideoGrid({ videos, title }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">
          No videos found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <h2 className="text-2xl font-bold" data-testid="text-section-title">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 md:gap-8">
        {videos.map((video) => (
          <LazyVideoCard key={video.id} video={video} variant="grid" />
        ))}
      </div>
    </div>
  );
}
