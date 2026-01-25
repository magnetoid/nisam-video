import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoGrid } from "@/components/VideoGrid";
import { SEO } from "@/components/SEO";
import type { Category, VideoWithRelations } from "@shared/schema";

export default function Categories() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | "others" | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: videos = [] } = useQuery<VideoWithRelations[]>({
    queryKey: ["/api/videos"],
  });

  // Count videos for each category
  const categoriesWithCounts = categories
    .map((category) => ({
      category,
      count: videos.filter((v) =>
        v.categories?.some((c) => c.id === category.id),
      ).length,
    }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);

  // Top 20 categories by video count
  const top20Categories = categoriesWithCounts.slice(0, 20);
  
  // Categories outside top 20
  const otherCategories = categoriesWithCounts.slice(20);
  
  // Videos in "others" (not in top 20)
  const otherCategoryIds = new Set(otherCategories.map(c => c.category.id));
  const othersVideos = videos.filter((v) =>
    v.categories?.some((c) => otherCategoryIds.has(c.id))
  );

  // Featured category (first one with most videos)
  const featuredGroup = top20Categories[0];
  const featuredVideo = featuredGroup ? videos.find((v) =>
    v.categories?.some((c) => c.id === featuredGroup.category.id)
  ) : null;

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
      {featuredVideo && featuredGroup && (
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
                  {featuredGroup.category.name}
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
            All Categories ({videos.length})
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
              data-testid={`button-filter-${category.slug}`}
            >
              {category.name} ({count})
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
              Others ({othersVideos.length})
            </button>
          )}
        </div>
      </div>

      {/* Videos Grid */}
      <div className="px-4 sm:px-8 md:px-16 space-y-12 pb-16">
        {selectedCategory === null ? (
          // Show all videos
          <VideoGrid videos={videos} title="All Videos" />
        ) : selectedCategory === "others" ? (
          // Show videos from other categories
          <VideoGrid videos={othersVideos} title="Other Categories" />
        ) : (
          // Show videos from selected category
          <VideoGrid
            videos={videos.filter((v) =>
              v.categories?.some((c) => c.id === selectedCategory)
            )}
            title={top20Categories.find((g) => g.category.id === selectedCategory)?.category.name}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
