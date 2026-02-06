import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { VideoGrid } from "@/components/VideoGrid";
import { VideoWithRelations } from "@shared/schema";

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  // Simple slug to name conversion (replace hyphens with spaces)
  // This is a heuristic. Ideally tags should have slugs in DB.
  const tagName = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "";

  const { data: videos, isLoading } = useQuery<VideoWithRelations[]>({
    queryKey: [`/api/videos?tagName=${encodeURIComponent(tagName)}`],
    enabled: !!tagName,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 capitalize">Tag: {tagName}</h1>
      <VideoGrid videos={videos || []} isLoading={isLoading} />
    </div>
  );
}
