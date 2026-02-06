import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoGrid } from "@/components/VideoGrid";
import { SEO } from "@/components/SEO";
import type { LocalizedCategory, VideoWithLocalizedRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function Categories() {
  const [, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | "others" | null>(null);

  const { data: categories = [] } = useQuery<LocalizedCategory[]>({
    queryKey: ["/api/categories", i18n.language],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/categories?lang=${i18n.language}`);
      return res.json();
    },
  });

  const categoriesWithCounts = useMemo(() => {
    return categories
      .map((category) => ({ category, count: category.videoCount || 0 }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [categories]);

  const top20Categories = categoriesWithCounts.slice(0, 20);
  const otherCategories = categoriesWithCounts.slice(20);
  const othersCount = otherCategories.reduce((sum, g) => sum + g.count, 0);
  const totalVideosCount = categoriesWithCounts.reduce((sum, g) => sum + g.count, 0);

  const featuredCategory = top20Categories[0]?.category || null;

  const { data: featuredVideos = [] } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos", "featured-category", featuredCategory?.id, i18n.language],
    enabled: !!featuredCategory?.id,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/videos?categoryId=${featuredCategory!.id}&limit=1&lang=${i18n.language}`,
      );
      return res.json();
    },
  });

  const featuredVideo = featuredVideos[0] || null;

  const { data: gridVideos = [] } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos", "category-grid", selectedCategory, i18n.language],
    queryFn: async () => {
      if (!selectedCategory || selectedCategory === "others") {
        const res = await apiRequest("GET", `/api/videos?limit=60&lang=${i18n.language}`);
        return res.json();
      }
      const res = await apiRequest(
        "GET",
        `/api/videos?categoryId=${selectedCategory}&limit=60&lang=${i18n.language}`,
      );
      return res.json();
    },
  });

  const currentUrl = `${window.location.origin}/categories`;
  const hreflangLinks = [
    { lang: "sr-Latn", url: currentUrl },
    { lang: "en", url: currentUrl },
    { lang: "x-default", url: currentUrl },
  ];

  // CollectionPage structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Browse Video Categories",
    description: "Explore videos organized by AI-powered categories",
    url: currentUrl,
    numberOfItems: categories.length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Browse Categories"
        description="Explore videos organized by AI-powered categories. Discover content across topics like technology, entertainment, education, and more."
        path="/categories"
        canonical={currentUrl}
        hreflang={hreflangLinks}
        structuredData={structuredData}
      />
      <Header />

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {/* Hero Section */}
      {featuredVideo && featuredCategory && (
        <div className="relative h-[40vh] md:h-[70vh]">
          <div className="absolute inset-0">
            <img
              src={featuredVideo.thumbnailUrl}
              alt={featuredVideo.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
          </div>

          <div className="relative h-full flex items-end pb-24 px-4 sm:px-8 md:px-16">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Featured Category
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {featuredCategory.translations?.[0]?.name || featuredCategory.id}
                </span>
              </div>

              <h1
                className="text-4xl md:text-6xl font-bold"
                data-testid="text-hero-title"
              >
                {featuredVideo.title}
              </h1>

              {featuredVideo.description && (
                <p className="text-base md:text-lg text-foreground/90 line-clamp-3">
                  {featuredVideo.description}
                </p>
              )}

              <button
                onClick={() =>
                  setLocation(
                    `/video/${featuredVideo.slug || featuredVideo.id}`,
                  )
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

      {/* Categories Grid/Filter */}
      <div className="px-4 sm:px-8 md:px-16 py-8">
        <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "bg-card text-card-foreground hover-elevate"
            }`}
            data-testid="button-filter-all"
          >
            Latest Videos ({totalVideosCount})
          </button>
          {top20Categories.map(({ category, count }) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground hover-elevate"
              }`}
              data-testid={`button-filter-${category.id}`}
            >
              {(category.translations?.[0]?.name || category.id)} ({count})
            </button>
          ))}
          {otherCategories.length > 0 && (
            <button
              onClick={() => setSelectedCategory("others")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === "others"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground hover-elevate"
              }`}
              data-testid="button-filter-others"
            >
              Others ({othersCount})
            </button>
          )}
        </div>
      </div>

      {/* Videos Grid */}
      <div className="px-4 sm:px-8 md:px-16 space-y-12 pb-16">
        {selectedCategory === "others" ? (
          <div className="text-muted-foreground">
            Select a category to view videos. “Others” groups long-tail categories for browsing.
          </div>
        ) : (
          <VideoGrid
            videos={gridVideos}
            title={
              selectedCategory
                ? (top20Categories.find((g) => g.category.id === selectedCategory)?.category.translations?.[0]?.name ||
                    "Category Videos")
                : "Latest Videos"
            }
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
