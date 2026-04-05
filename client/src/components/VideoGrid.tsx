import { LazyVideoCard } from "./LazyVideoCard";
import type { VideoWithLocalizedRelations } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

interface VideoGridProps {
  videos: VideoWithLocalizedRelations[];
  title?: string;
  isLoading?: boolean;
  isFetching?: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
}

function VideoCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="w-full aspect-video rounded-md" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-6 w-10 rounded-md" />
      </div>
    </div>
  );
}

export function VideoGrid({
  videos,
  title,
  isLoading,
  isFetching,
  skeletonCount = 18,
  emptyMessage,
}: VideoGridProps) {
  const { t } = useTranslation();
  const showSkeleton = (isLoading || isFetching) && videos.length === 0;
  const message = emptyMessage || t("common.noVideosFound", "No videos found");

  if (showSkeleton) {
    return (
      <div className="space-y-6" data-testid="video-grid-skeleton">
        {title && (
          <h2 className="text-2xl font-bold" data-testid="text-section-title">
            {title}
          </h2>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <VideoCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">
          {message}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
        {videos.map((video) => (
          <LazyVideoCard key={video.id} video={video} variant="grid" />
        ))}
      </div>
    </div>
  );
}
