import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CarouselRow } from "@/components/CarouselRow";
import { SearchOverlay } from "@/components/SearchOverlay";
import { SEO } from "@/components/SEO";
import { LikeStatusBatchProvider } from "@/components/LikeButton";
import type { LocalizedCategory, VideoWithLocalizedRelations } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import HeroImageSlider from '@/components/HeroImageSlider';

interface CarouselData {
  hero: VideoWithLocalizedRelations[];
  recent: VideoWithLocalizedRelations[];
  trending: VideoWithLocalizedRelations[];
  byCategory: Record<string, VideoWithLocalizedRelations[]>;
}

export default function Home() {
  const [showSearch, setShowSearch] = useState(false);
  const { t, i18n } = useTranslation();

  const {
    data: carouselData,
    isLoading: carouselsLoading,
  } = useQuery<CarouselData>({
    queryKey: ["/api/videos/carousels", i18n.language],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
        const res = await apiRequest("GET", `/api/videos/carousels?lang=${i18n.language}`);
        return res.json();
    }
  });

  const { data: categories = [] } = useQuery<LocalizedCategory[]>({
    queryKey: ["/api/categories", i18n.language],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
        const res = await apiRequest("GET", `/api/categories?lang=${i18n.language}`);
        return res.json();
    }
  });

  const { data: searchVideos = [] } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos?limit=100", i18n.language],
    enabled: showSearch,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
        const res = await apiRequest("GET", `/api/videos?limit=100&lang=${i18n.language}`);
        return res.json();
    }
  });

  const featuredVideos = carouselData?.hero ?? [];
  const recentVideos = carouselData?.recent ?? [];
  const trendingVideos = carouselData?.trending ?? [];
  const videosByCategory = carouselData?.byCategory ?? {};

  const heroItems = useMemo(() => {
    const primary = featuredVideos.length > 0 ? featuredVideos : recentVideos;
    return primary.slice(0, 5).map((v) => ({
      id: v.id,
      title: v.title,
      imageUrl: v.thumbnailUrl || null,
    }));
  }, [featuredVideos, recentVideos]);

  const allVideoIds = useMemo(() => {
    const ids: string[] = [];
    featuredVideos.forEach(v => ids.push(v.id));
    recentVideos.forEach(v => ids.push(v.id));
    trendingVideos.forEach(v => ids.push(v.id));
    // Only include first 6 categories
    Object.entries(videosByCategory).slice(0, 6).forEach(([, videos]) => {
      videos.forEach(v => ids.push(v.id));
    });
    return Array.from(new Set(ids));
  }, [recentVideos, trendingVideos, videosByCategory]);

  const websiteStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "nisam.video",
    description:
      "AI-powered video aggregation hub with curated YouTube content",
    url: window.location.origin,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${window.location.origin}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const currentUrl = window.location.origin;
  const hreflangLinks = [
    { lang: "sr-Latn", url: currentUrl },
    { lang: "en", url: currentUrl },
    { lang: "x-default", url: currentUrl },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        path="/"
        structuredData={websiteStructuredData}
        canonical={currentUrl}
        hreflang={hreflangLinks}
      />
      <Header onSearchClick={() => setShowSearch(true)} />

      <main className="pt-16">
        <LikeStatusBatchProvider videoIds={allVideoIds}>
          <div className="space-y-0">
            <HeroImageSlider items={heroItems} />

            {recentVideos.length > 0 && (
              <CarouselRow title="Recently Added" videos={recentVideos} />
            )}

            {Object.entries(videosByCategory).slice(0, 6).map(
              ([categoryName, categoryVideos]) => (
                <CarouselRow
                  key={categoryName}
                  title={categoryName}
                  videos={categoryVideos}
                />
              ),
            )}

            {trendingVideos.length > 0 && (
              <CarouselRow title="Trending" videos={trendingVideos} />
            )}
          </div>
        </LikeStatusBatchProvider>

        {!carouselsLoading && recentVideos.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold" data-testid="text-empty-state">
                No videos available
              </h2>
              <p className="text-muted-foreground max-w-md">
                Visit the admin panel to add YouTube channels and start
                aggregating videos
              </p>
            </div>
          </div>
        )}

        {carouselsLoading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
            <div className="text-center space-y-4" data-testid="loading-state">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading videos...</p>
            </div>
          </div>
        )}
      </main>

      <SearchOverlay
        open={showSearch}
        onClose={() => setShowSearch(false)}
        results={searchVideos}
        categories={categories}
      />

      <Footer />
    </div>
  );
}
