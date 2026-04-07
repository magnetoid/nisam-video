import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { CarouselRow } from "./CarouselRow";
import { apiRequest } from "@/lib/queryClient";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import type { VideoWithLocalizedRelations, Channel } from "@shared/schema";

interface ChannelCarouselRowProps {
  channelName: string;
  lang: string;
  limit?: number;
}

export function ChannelCarouselRow({ channelName, lang, limit = 15 }: ChannelCarouselRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(ref, {
    freezeOnceVisible: true,
    rootMargin: "200px",
  });
  const isVisible = !!entry?.isIntersecting;

  // First find the channel by name
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
    staleTime: 10 * 60 * 1000,
    enabled: isVisible,
  });

  const channel = channels.find(
    (c) => c.name.toLowerCase().includes(channelName.toLowerCase())
  );

  // Then fetch videos for that channel
  const { data: videos = [], isLoading } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: [`/api/videos/channel/${channel?.id}`, lang, limit],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/videos?channelId=${channel!.id}&limit=${limit}&lang=${lang}`);
      return res.json();
    },
    enabled: isVisible && !!channel?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (!isVisible && !videos.length) {
    return <div ref={ref} className="h-48 w-full" />;
  }

  if (isLoading && channel) {
    return (
      <div ref={ref} className="space-y-2 py-4">
        <div className="flex items-center justify-between px-4 md:px-12">
          <div className="h-6 w-32 bg-muted/20 animate-pulse rounded" />
        </div>
        <div className="flex gap-4 overflow-hidden px-4 md:px-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-video w-[280px] bg-muted/10 animate-pulse rounded-lg flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!channel || videos.length === 0) {
    return <div ref={ref} />;
  }

  return (
    <div ref={ref}>
      <CarouselRow title={channel.name} videos={videos} />
    </div>
  );
}
