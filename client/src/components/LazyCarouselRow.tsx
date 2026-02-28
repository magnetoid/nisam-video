import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CarouselRow } from "./CarouselRow";
import { apiRequest } from "@/lib/queryClient";
import type { VideoWithLocalizedRelations } from "@shared/schema";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface LazyCarouselRowProps {
  title: string;
  categoryId: string;
  lang: string;
}

export function LazyCarouselRow({ title, categoryId, lang }: LazyCarouselRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(ref, {
    freezeOnceVisible: true,
    rootMargin: "200px", // Preload before it enters viewport
  });
  const isVisible = !!entry?.isIntersecting;

  const { data: videos = [], isLoading } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: [`/api/videos/category/${categoryId}`, lang],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/videos?categoryId=${categoryId}&limit=10&lang=${lang}`);
      return res.json();
    },
    enabled: isVisible,
    staleTime: 5 * 60 * 1000,
  });

  if (!isVisible && !videos.length) {
    return <div ref={ref} className="h-48 w-full" />; // Placeholder height
  }

  if (isLoading) {
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

  if (videos.length === 0) return null;

  return (
    <div ref={ref}>
      <CarouselRow title={title} videos={videos} />
    </div>
  );
}
