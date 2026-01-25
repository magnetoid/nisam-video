import { Play, Info } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import type { VideoWithRelations } from "@shared/schema";

interface HeroBillboardProps {
  video?: VideoWithRelations;
}

export function HeroBillboard({ video }: HeroBillboardProps) {
  const [, setLocation] = useLocation();
  if (!video) {
    return (
      <div className="relative h-[70vh] md:h-[80vh] w-full bg-muted animate-pulse" />
    );
  }

  const getMaxResolutionThumbnail = (thumbnailUrl: string, videoId: string) => {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  };

  const heroImageUrl = getMaxResolutionThumbnail(
    video.thumbnailUrl,
    video.videoId,
  );

  return (
    <div className="relative h-[70vh] md:h-[80vh] w-full overflow-hidden">
      <img
        src={heroImageUrl}
        alt={video.title}
        className="absolute inset-0 w-full h-full object-cover"
        fetchPriority="high"
        loading="eager"
        data-testid="img-hero"
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(8,8,8,1) 30%, transparent 70%)",
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

      <div className="relative h-full flex items-center px-4 md:px-12">
        <div className="max-w-2xl space-y-4" data-testid="hero-content">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight drop-shadow-lg"
            data-testid="text-hero-title"
          >
            {video.title}
          </h1>

          <div className="flex items-center gap-3 text-sm text-foreground/80">
            <span data-testid="text-channel">{video.channel.name}</span>
            {video.viewCount && (
              <>
                <span>•</span>
                <span data-testid="text-views">{video.viewCount} views</span>
              </>
            )}
            {video.publishDate && (
              <>
                <span>•</span>
                <span data-testid="text-date">{video.publishDate}</span>
              </>
            )}
          </div>

          {video.description && (
            <p
              className="text-base md:text-lg text-foreground/90 line-clamp-3 max-w-xl drop-shadow"
              data-testid="text-description"
            >
              {video.description}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setLocation(`/video/${video.slug || video.id}`)}
              data-testid="button-play"
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              <Play className="h-5 w-5 fill-current" />
              Play
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation(`/video/${video.slug || video.id}`)}
              data-testid="button-info"
              className="gap-2 backdrop-blur-sm bg-background/30 border-foreground/30 hover:bg-background/50"
            >
              <Info className="h-5 w-5" />
              More Info
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
