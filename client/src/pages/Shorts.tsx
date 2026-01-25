import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import type { VideoWithRelations } from "@shared/schema";
import { Play, Smartphone, Film } from "lucide-react";
import { SiYoutube, SiTiktok } from "react-icons/si";

type FilterType = "all" | "youtube_short" | "tiktok";

export default function Shorts() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<FilterType>("all");

  const queryUrl = filter === "all" 
    ? "/api/shorts?limit=100" 
    : `/api/shorts?type=${filter}&limit=100`;

  const { data: shorts = [], isLoading } = useQuery<VideoWithRelations[]>({
    queryKey: [queryUrl],
  });

  const currentUrl = `${window.location.origin}/shorts`;
  const hreflangLinks = [
    { lang: "sr-Latn", url: currentUrl },
    { lang: "en", url: currentUrl },
    { lang: "x-default", url: currentUrl },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Shorts",
    description: "Watch the latest YouTube Shorts and TikTok videos",
    url: currentUrl,
    numberOfItems: shorts.length,
  };

  const filterButtons = [
    { key: "all" as FilterType, label: "All Shorts", icon: Film },
    { key: "youtube_short" as FilterType, label: "YouTube", icon: SiYoutube },
    { key: "tiktok" as FilterType, label: "TikTok", icon: SiTiktok },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Shorts | YouTube Shorts & TikTok Videos"
        description="Watch the latest YouTube Shorts and TikTok videos. Discover quick, engaging content in vertical format."
        path="/shorts"
        canonical={currentUrl}
        hreflang={hreflangLinks}
        structuredData={structuredData}
      />
      <Header />

      <div className="h-16" />

      <div className="flex-1 px-4 sm:px-8 md:px-16 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Smartphone className="h-8 w-8 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-shorts-title">
            Shorts
          </h1>
        </div>

        <p className="text-muted-foreground mb-8 text-lg">
          Quick, engaging vertical videos from YouTube Shorts and TikTok
        </p>

        <div className="flex flex-wrap gap-3 mb-10">
          {filterButtons.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
              className="gap-2"
              data-testid={`button-filter-${key}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        )}

        {!isLoading && shorts.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <Smartphone className="h-16 w-16 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground text-lg">
              No shorts available yet. Short videos will appear here when channels are scraped.
            </p>
          </div>
        )}

        {!isLoading && shorts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {shorts.map((video) => (
              <ShortCard
                key={video.id}
                video={video}
                onClick={() => setLocation(`/video/${video.slug || video.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

interface ShortCardProps {
  video: VideoWithRelations;
  onClick: () => void;
}

function ShortCard({ video, onClick }: ShortCardProps) {
  const isYouTubeShort = video.videoType === "youtube_short";
  const isTikTok = video.videoType === "tiktok";

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-lg overflow-hidden hover-elevate active-elevate-2 transition-all duration-300"
      data-testid={`card-short-${video.id}`}
    >
      <div className="aspect-[9/16] bg-muted">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="absolute top-2 right-2">
        {isYouTubeShort && (
          <div className="bg-red-600 p-1.5 rounded-full">
            <SiYoutube className="h-3 w-3 text-white" />
          </div>
        )}
        {isTikTok && (
          <div className="bg-black p-1.5 rounded-full">
            <SiTiktok className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="bg-white/90 rounded-full p-4">
          <Play className="h-8 w-8 text-black fill-black" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <h3 className="text-white text-sm font-medium line-clamp-2">
          {video.title}
        </h3>
        {video.channel && (
          <p className="text-white/70 text-xs mt-1">{video.channel.name}</p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 group-hover:opacity-0 transition-opacity duration-300">
        <h3 className="text-white text-xs font-medium line-clamp-2 drop-shadow-lg">
          {video.title}
        </h3>
      </div>
    </div>
  );
}
