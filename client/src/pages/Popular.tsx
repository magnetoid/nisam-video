import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import type { VideoWithLocalizedRelations } from "@shared/schema";
import { TrendingUp, Eye, Play, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getOptimizedThumbnail, getMaxResolutionThumbnail } from "@/lib/video";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Popular() {
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const entry = useIntersectionObserver(loadMoreRef, {
    threshold: 0.1,
    rootMargin: "100px",
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["popular-videos", i18n.language],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await apiRequest(
        "GET", 
        `/api/videos?sort=popularity&limit=24&offset=${pageParam}&lang=${i18n.language}`
      );
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 24 ? allPages.length * 24 : undefined;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  useEffect(() => {
    if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [entry?.isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const videos = data?.pages.flat() || [];
  const topVideo = videos[0];
  const gridVideos = videos.slice(1);

  const currentUrl = `${window.location.origin}/popular`;
  const hreflangLinks = [
    { lang: "sr-Latn", url: currentUrl },
    { lang: "en", url: currentUrl },
    { lang: "x-default", url: currentUrl },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("popular.title", "Popular Videos"),
    description: t("popular.description", "Watch the most popular and trending videos"),
    url: currentUrl,
    numberOfItems: videos.length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("popular.title", "Popular Videos")}
        description={t("popular.metaDescription", "Watch the most popular and trending videos. Discover what's hot across all categories sorted by view count.")}
        path="/popular"
        canonical={currentUrl}
        hreflang={hreflangLinks}
        structuredData={structuredData}
      />
      <Header />

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {isLoading && videos.length === 0 ? (
        <div className="h-[70vh] flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Hero Section with #1 Most Popular */}
          {topVideo && (
            <div className="relative h-[60vh] md:h-[75vh] w-full overflow-hidden group cursor-pointer" onClick={() => setLocation(`/video/${topVideo.slug || topVideo.id}`)}>
              <div className="absolute inset-0">
                <img
                  src={getMaxResolutionThumbnail(topVideo.thumbnailUrl, topVideo.videoId)}
                  alt={topVideo.title}
                  className="w-full h-full object-cover transition-transform duration-[10s] ease-linear group-hover:scale-105"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
              </div>

              <div className="absolute bottom-0 left-0 w-full p-6 md:p-16 flex flex-col justify-end items-start z-10">
                <div className="max-w-4xl space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-700">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary text-primary-foreground px-3 py-1 text-xs md:text-sm font-bold uppercase tracking-wider rounded-md flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                      {t("popular.numberOneTrending", "#1 Trending")}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-white leading-tight drop-shadow-lg">
                    {topVideo.title}
                  </h1>

                  <div className="flex items-center gap-4 text-white/90 font-medium text-sm md:text-lg">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      <span>{topVideo.viewCount} {t("common.views", "views")}</span>
                    </div>
                    {topVideo.publishDate && (
                      <>
                        <span className="text-white/50">•</span>
                        <span>{topVideo.publishDate}</span>
                      </>
                    )}
                  </div>

                  <p className="text-base md:text-xl text-white/80 line-clamp-2 max-w-2xl hidden md:block">
                    {topVideo.description}
                  </p>

                  <div className="pt-4">
                    <Button 
                      size="lg" 
                      className="gap-2 text-base md:text-lg h-12 md:h-14 px-8 bg-white text-black hover:bg-white/90 border-none font-bold shadow-xl shadow-black/20"
                    >
                      <Play className="h-5 w-5 fill-current" /> {t("popular.playNow", "Play Now")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grid Layout */}
          <div className="px-4 sm:px-8 md:px-16 py-12 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                {t("popular.trendingNow", "Trending Now")}
              </h2>
            </div>

            {gridVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {gridVideos.map((video, index) => (
                  <div 
                    key={video.id} 
                    className="group relative flex flex-col gap-3 cursor-pointer"
                    onClick={() => setLocation(`/video/${video.slug || video.id}`)}
                  >
                    <div className="aspect-video relative rounded-lg overflow-hidden bg-muted">
                      <img
                        src={getOptimizedThumbnail(video.thumbnailUrl)}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300">
                          <Play className="h-6 w-6 fill-white text-white" />
                        </div>
                      </div>
                      
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-white">
                        #{index + 2}
                      </div>
                      
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-xs font-medium text-white">
                          {video.duration}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {video.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{video.viewCount} {t("common.views", "views")}</span>
                        <span>•</span>
                        <span>{video.publishDate}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">
                  {t("popular.noVideosFound", "No videos found. Check back later!")}
                </p>
              </div>
            )}

            {/* Load More Trigger */}
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {isFetchingNextPage && (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}
