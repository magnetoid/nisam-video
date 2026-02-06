import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { VideoGrid } from "@/components/VideoGrid";
import { Category, VideoWithRelations } from "@shared/schema";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<any | null>(null);

  // Fetch all categories to resolve slug to ID
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  useEffect(() => {
    if (categories && slug) {
      const found = categories.find((c: any) => c.slug === slug);
      setCategory(found || null);
    }
  }, [categories, slug]);

  const { data: videos, isLoading } = useQuery<VideoWithRelations[]>({
    queryKey: [`/api/videos?categoryId=${category?.id}`],
    enabled: !!category?.id,
  });

  if (!categories) return <div className="p-8">Loading...</div>;
  if (!category) return <div className="p-8">Category not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{category.name}</h1>
      <VideoGrid videos={videos || []} isLoading={isLoading} />
    </div>
  );
}
