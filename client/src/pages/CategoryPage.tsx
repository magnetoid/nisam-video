import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoGrid } from "@/components/VideoGrid";
import { SEO } from "@/components/SEO";
import { LocalizedCategory, VideoWithLocalizedRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();

  // Fetch specific category by slug with language
  const { data: category, isLoading: isCategoryLoading } = useQuery<LocalizedCategory>({
    queryKey: [`/api/categories/${slug}`, i18n.language],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/categories/${slug}?lang=${i18n.language}`);
      return res.json();
    },
    enabled: !!slug
  });

  const { data: videos, isLoading: isVideosLoading } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: [`/api/videos`, category?.id, i18n.language],
    queryFn: async () => {
       const res = await apiRequest("GET", `/api/videos?categoryId=${category?.id}&lang=${i18n.language}`);
       return res.json();
    },
    enabled: !!category?.id,
  });

  if (isCategoryLoading) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">{t("common.loading", "Loading...")}</div>
      <Footer />
    </div>
  );

  if (!category) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">{t("categories.notFound", "Category not found")}</div>
      <Footer />
    </div>
  );

  const currentUrl = `${window.location.origin}/category/${slug}`;

  const categoryStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: category.name,
        description: category.description || `Browse ${category.name} videos on nisam.video`,
        url: currentUrl,
        numberOfItems: videos?.length ?? 0,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: window.location.origin },
          { "@type": "ListItem", position: 2, name: "Categories", item: `${window.location.origin}/categories` },
          { "@type": "ListItem", position: 3, name: category.name, item: currentUrl },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={category.name}
        description={category.description || `Browse the best ${category.name} videos on nisam.video. Curated and categorized by AI.`}
        canonical={currentUrl}
        structuredData={categoryStructuredData}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
          {category.description && (
            <p className="text-muted-foreground">{category.description}</p>
          )}
        </div>
        <VideoGrid videos={videos || []} isLoading={isVideosLoading} />
      </main>
      <Footer />
    </div>
  );
}
