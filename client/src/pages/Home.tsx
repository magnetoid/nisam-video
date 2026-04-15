import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CarouselRow } from "@/components/CarouselRow";
import { LazyCarouselRow } from "@/components/LazyCarouselRow";
import { SearchOverlay } from "@/components/SearchOverlay";
import { SEO } from "@/components/SEO";
import { LikeStatusBatchProvider } from "@/components/LikeButton";
import type { Channel, LocalizedCategory, VideoWithLocalizedRelations, SupportedLanguage } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { getMaxResolutionThumbnail } from "@/lib/video";
import HeroImageSlider from '@/components/HeroImageSlider';
import { ChannelCarouselRow } from "@/components/ChannelCarouselRow";

import { HeroSettings } from "@shared/schema";

interface CarouselData {
  hero: VideoWithLocalizedRelations[];
  recent: VideoWithLocalizedRelations[];
  trending: VideoWithLocalizedRelations[];
  popular: VideoWithLocalizedRelations[];
  popularSegments?: {
    id: string;
    title: string;
    videos: VideoWithLocalizedRelations[];
  }[];
  // byCategory removed from main fetch
}

export default function Home() {
  const [showSearch, setShowSearch] = useState(false);
  const { t, i18n } = useTranslation();

  const { data: heroSettings } = useQuery<HeroSettings>({
    queryKey: ['/api/hero/config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/hero/config');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: carouselData,
    isLoading: carouselsLoading,
  } = useQuery<CarouselData>({
    queryKey: ["/api/videos/carousels", i18n.language, "main", heroSettings],
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!heroSettings,
    queryFn: async () => {
        // Load only main sections initially for speed
        const sections = ["hero"];
        if (heroSettings?.showRecent !== false) sections.push("recent");
        if (heroSettings?.showTrending !== false) sections.push("trending");
        if (heroSettings?.showPopular) sections.push("popular");
        
        const res = await apiRequest("GET", `/api/videos/carousels?lang=${i18n.language}&sections=${sections.join(",")}`);
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

  const carouselCategories = useMemo(() => {
    const MIN_VIDEOS = 12;
    const MAX_CATEGORIES = 10;
    return [...categories]
      .filter((c) => (c.videoCount || 0) >= MIN_VIDEOS)
      .sort((a, b) => (b.videoCount || 0) - (a.videoCount || 0))
      .slice(0, MAX_CATEGORIES);
  }, [categories]);

  const { data: searchVideos = [], isLoading: searchLoading, isFetching: searchFetching } = useQuery<VideoWithLocalizedRelations[]>({
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
  const popularVideos = carouselData?.popular ?? [];
  const popularSegments = carouselData?.popularSegments ?? [];

  const heroItems = useMemo(() => {
    const primary = featuredVideos.length > 0 ? featuredVideos : recentVideos;
    return primary.map((v) => ({
      id: v.id,
      title: v.title,
      imageUrl: v.thumbnailUrl ? getMaxResolutionThumbnail(v.thumbnailUrl, v.videoId) : null,
      slug: v.slug || v.id,
      primaryCategory: (v.categories?.[0] as any)?.name || (v.categories?.[0] as any)?.translations?.[0]?.name || undefined,
      secondaryCategories: (v.categories || []).slice(1).map((c) => c.name || c.translations?.[0]?.name).filter(Boolean) as string[],
      viewCount: v.viewCount || null,
      publishDate: v.publishDate || null,
      description: v.description || null,
    }));
  }, [featuredVideos, recentVideos]);

  const allVideoIds = useMemo(() => {
    const ids: string[] = [];
    featuredVideos.forEach(v => ids.push(v.id));
    recentVideos.forEach(v => ids.push(v.id));
    trendingVideos.forEach(v => ids.push(v.id));
    popularVideos.forEach(v => ids.push(v.id));
    popularSegments.forEach((segment) => segment.videos.forEach((v) => ids.push(v.id)));
    return Array.from(new Set(ids));
  }, [featuredVideos, recentVideos, trendingVideos, popularVideos, popularSegments]);

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

  // Fetch supported languages for hreflang
  const { data: languages = [] } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
    staleTime: Infinity,
  });

  const origin = window.location.origin;
  
  // Construct language-specific URLs dynamically
  const hreflangLinks = languages.map(lang => {
    // For home page, we want / or /en/
    const prefix = lang.isDefault ? '/' : `/${lang.code}/`;
    return {
      lang: lang.code,
      url: `${origin}${prefix}`
    };
  });

  // Add x-default
  hreflangLinks.push({ 
    lang: "x-default", 
    url: `${origin}/` 
  });
  
  const currentLang = languages.find(l => l.code === i18n.language);
  const currentPrefix = currentLang?.isDefault ? '/' : `/${i18n.language}/`;
  // Fallback
  const effectivePrefix = currentLang ? currentPrefix : (i18n.language === 'en' ? '/en/' : '/');
  
  const currentCanonical = `${origin}${effectivePrefix}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("home.metaTitle", "AI-Powered Video Hub – Discover Curated Videos")}
        description={t("home.metaDescription", "Discover and explore curated video content with AI-powered categorization. Browse trending, popular, and recently added YouTube and TikTok videos – organized just for you.")}
        path={effectivePrefix}
        structuredData={websiteStructuredData}
        canonical={currentCanonical}
        hreflang={hreflangLinks}
      />
      <Header onSearchClick={() => setShowSearch(true)} />

      <main id="main-content" className="pt-16">
        <LikeStatusBatchProvider videoIds={allVideoIds}>
          <div className="space-y-0">
            <HeroImageSlider
              items={heroItems}
              badgeMode={(heroSettings?.homeHeroMode as any) || 'primary'}
            />

            {recentVideos.length > 0 && (
              <CarouselRow title={t("home.recent", "Recently Added")} videos={recentVideos} />
            )}

            {trendingVideos.length > 0 && (
              <CarouselRow title={t("home.trending", "Trending")} videos={trendingVideos} />
            )}

            <ChannelCarouselRow channelName="N1" lang={i18n.language} />

            {popularSegments.length > 0 ? (
              popularSegments.map(segment => (
                <CarouselRow key={segment.id} title={segment.title} videos={segment.videos} />
              ))
            ) : (
              popularVideos.length > 0 && (
                <CarouselRow title={t("home.popular", "Popular Videos")} videos={popularVideos} />
              )
            )}

            {/* Lazy load categories */}
            {carouselCategories.map((category) => (
              <LazyCarouselRow
                key={category.id}
                title={category.name || category.translations?.[0]?.name || t("category.default", "Category")}
                categoryId={category.id}
                lang={i18n.language}
              />
            ))}
          </div>
        </LikeStatusBatchProvider>

        {!carouselsLoading && recentVideos.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold" data-testid="text-empty-state">
                {t("home.noVideos", "No videos available")}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {t(
                  "home.adminPrompt",
                  "Visit the admin panel to add YouTube channels and start aggregating videos",
                )}
              </p>
            </div>
          </div>
        )}

        {carouselsLoading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
            <div className="text-center space-y-4" data-testid="loading-state">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">{t("home.loading", "Loading videos...")}</p>
            </div>
          </div>
        )}
      </main>

      <SearchOverlay
        open={showSearch}
        onClose={() => setShowSearch(false)}
        results={searchVideos}
        categories={categories}
        isLoading={searchLoading || searchFetching}
      />

      <Footer />
    </div>
  );
}
