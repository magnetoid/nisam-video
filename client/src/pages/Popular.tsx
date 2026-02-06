import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CarouselRow } from "@/components/CarouselRow";
import { SEO } from "@/components/SEO";
import type { VideoWithLocalizedRelations } from "@shared/schema";
import { TrendingUp, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Popular() {
  const [, setLocation] = useLocation();
  const { i18n } = useTranslation();

  const { data: videos = [] } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos?limit=500", i18n.language],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/videos?limit=500&lang=${i18n.language}`);
      return res.json();
    },
  });

  const { sortedVideos, mega, high, medium, rising, topVideo } = useMemo(() => {
    const parseViewCount = (viewCount: string | null): number => {
      if (!viewCount) return 0;
      const match = viewCount.match(/[\d,]+/);
      if (!match) return 0;
      return parseInt(match[0].replace(/,/g, ""), 10);
    };

    const calculatePopularityScore = (video: VideoWithLocalizedRelations): number => {
      const externalViews = parseViewCount(video.viewCount);
      const internalViews = video.internalViewsCount || 0;
      const likes = video.likesCount || 0;
      return externalViews * 0.3 + internalViews * 50 + likes * 100;
    };

    const sorted = [...videos]
      .map((v) => ({
        ...v,
        parsedViews: parseViewCount(v.viewCount),
        popularityScore: calculatePopularityScore(v),
      }))
      .sort((a, b) => b.popularityScore - a.popularityScore);

    return {
      sortedVideos: sorted,
      mega: sorted.filter((v) => v.parsedViews >= 1000000),
      high: sorted.filter((v) => v.parsedViews >= 100000 && v.parsedViews < 1000000),
      medium: sorted.filter((v) => v.parsedViews >= 10000 && v.parsedViews < 100000),
      rising: sorted.filter((v) => v.parsedViews > 0 && v.parsedViews < 10000),
      topVideo: sorted[0],
    };
  }, [videos]);

  const currentUrl = `${window.location.origin}/popular`;
  const hreflangLinks = [
    { lang: "sr-Latn", url: currentUrl },
    { lang: "en", url: currentUrl },
    { lang: "x-default", url: currentUrl },
  ];

  // CollectionPage structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Popular Videos",
    description: "Watch the most popular and trending videos",
    url: currentUrl,
    numberOfItems: sortedVideos.length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Popular Videos"
        description="Watch the most popular and trending videos. Discover what's hot across all categories sorted by view count."
        path="/popular"
        canonical={currentUrl}
        hreflang={hreflangLinks}
        structuredData={structuredData}
      />
      <Header />

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {/* Hero Section with #1 Most Popular */}
      {topVideo && (
        <div className="relative h-[50vh] md:h-[70vh]">
          <div className="absolute inset-0">
            <img
              src={topVideo.thumbnailUrl}
              alt={topVideo.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
          </div>

          <div className="relative h-full flex items-end pb-24 px-4 sm:px-8 md:px-16">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-primary px-4 py-2 rounded-full">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-bold">#1 MOST POPULAR</span>
                </div>
              </div>

              <h1
                className="text-4xl md:text-6xl font-bold"
                data-testid="text-hero-title"
              >
                {topVideo.title}
              </h1>

              <div className="flex items-center gap-4 text-foreground/90">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  <span className="text-lg font-semibold">
                    {topVideo.viewCount}
                  </span>
                </div>
                {topVideo.publishDate && (
                  <>
                    <span>•</span>
                    <span>{topVideo.publishDate}</span>
                  </>
                )}
              </div>

              {topVideo.description && (
                <p className="text-base md:text-lg text-foreground/90 line-clamp-3">
                  {topVideo.description}
                </p>
              )}

              <button
                onClick={() =>
                  setLocation(`/video/${topVideo.slug || topVideo.id}`)
                }
                className="px-8 py-3 bg-white text-black font-semibold rounded hover-elevate active-elevate-2 transition-transform"
                data-testid="button-play-hero"
              >
                ▶ Play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popular Video Tiers */}
      <div className="px-4 sm:px-8 md:px-16 space-y-12 py-12">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Trending Now</h2>
          <p className="text-muted-foreground">
            The most watched videos on nisam.video
          </p>
        </div>

        {mega.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-bold">Mega Hits (1M+ views)</h3>
            </div>
            <CarouselRow title="" videos={mega} />
          </div>
        )}

        {high.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-bold">
                Highly Popular (100K+ views)
              </h3>
            </div>
            <CarouselRow title="" videos={high} />
          </div>
        )}

        {medium.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Eye className="h-6 w-6 text-muted-foreground" />
              <h3 className="text-xl font-bold">Popular (10K+ views)</h3>
            </div>
            <CarouselRow title="" videos={medium} />
          </div>
        )}

        {rising.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
              <h3 className="text-xl font-bold">Rising Stars</h3>
            </div>
            <CarouselRow title="" videos={rising} />
          </div>
        )}

        {videos.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No videos available. Start by scraping some channels!
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
