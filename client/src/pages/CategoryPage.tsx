import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoGrid } from "@/components/VideoGrid";
import { LocalizedCategory, VideoWithLocalizedRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
