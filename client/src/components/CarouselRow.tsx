import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LazyVideoCard } from "./LazyVideoCard";
import type { VideoWithRelations } from "@shared/schema";

interface CarouselRowProps {
  title: string;
  videos: VideoWithRelations[];
}

export function CarouselRow({ title, videos }: CarouselRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
    const newScrollLeft =
      scrollContainerRef.current.scrollLeft +
      (direction === "right" ? scrollAmount : -scrollAmount);

    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  if (!videos.length) return null;

  return (
    <div
      className="group/row relative py-8"
      data-testid={`carousel-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <h2
        className="text-xl md:text-2xl font-bold mb-4 px-4 md:px-12 tracking-tight uppercase text-sm"
        data-testid="text-carousel-title"
      >
        {title}
      </h2>

      <div className="relative">
        {showLeftArrow && (
          <div className="absolute left-0 top-0 bottom-0 w-12 md:w-16 flex items-center justify-start z-20 bg-gradient-to-r from-background to-transparent opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => scroll("left")}
              data-testid="button-scroll-left"
              className="h-full w-12 rounded-none hover:bg-transparent min-h-[44px]"
            >
              <ChevronLeft className="h-10 w-10" />
            </Button>
          </div>
        )}

        {showRightArrow && (
          <div className="absolute right-0 top-0 bottom-0 w-12 md:w-16 flex items-center justify-end z-20 bg-gradient-to-l from-background to-transparent opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => scroll("right")}
              data-testid="button-scroll-right"
              className="h-full w-12 rounded-none hover:bg-transparent min-h-[44px]"
            >
              <ChevronRight className="h-10 w-10" />
            </Button>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex gap-3 sm:gap-4 md:gap-6 overflow-x-auto scrollbar-hide scroll-smooth px-4 md:px-12 snap-x snap-mandatory"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            touchAction: "pan-x",
          }}
        >
          {videos.map((video) => (
            <div key={video.id} className="snap-start">
              <LazyVideoCard video={video} />
            </div>
          ))}

          <div className="flex-shrink-0 w-4" />
        </div>
      </div>
    </div>
  );
}
