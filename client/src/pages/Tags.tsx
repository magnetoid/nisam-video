import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoGrid } from "@/components/VideoGrid";
import { SEO } from "@/components/SEO";
import type { Tag, VideoWithRelations, TagImage } from "@shared/schema";

export default function Tags() {
  const [selectedTag, setSelectedTag] = useState<string | "others" | null>(null);

  const { data: videos = [] } = useQuery<VideoWithRelations[]>({
    queryKey: ["/api/videos"],
  });

  const { data: tagImages = [] } = useQuery<TagImage[]>({
    queryKey: ["/api/tag-images"],
  });

  const tagImageMap = useMemo(() => {
    return tagImages.reduce((acc, img) => {
      acc[img.tagName] = img;
      return acc;
    }, {} as Record<string, TagImage>);
  }, [tagImages]);

  const allTags = videos.reduce((acc, video) => {
    video.tags?.forEach((tag) => {
      if (!acc.find((t) => t.id === tag.id)) {
        acc.push(tag);
      }
    });
    return acc;
  }, [] as Tag[]);

  const tagCounts = allTags
    .map((tag) => ({
      tag,
      count: videos.filter((v) => v.tags?.some((t) => t.id === tag.id)).length,
    }))
    .sort((a, b) => b.count - a.count);

  const top20Tags = tagCounts.slice(0, 20);
  const otherTags = tagCounts.slice(20);
  const otherTagIds = new Set(otherTags.map(t => t.tag.id));
  const othersVideos = videos.filter((v) =>
    v.tags?.some((t) => otherTagIds.has(t.id))
  );

  const selectedTagData = selectedTag && selectedTag !== "others" 
    ? top20Tags.find((g) => g.tag.id === selectedTag) 
    : null;
  const heroImage = selectedTagData ? tagImageMap[selectedTagData.tag.tagName]?.imageUrl : null;
  const featuredTagWithImage = top20Tags.find(t => tagImageMap[t.tag.tagName]?.imageUrl);
  const defaultHeroImage = featuredTagWithImage ? tagImageMap[featuredTagWithImage.tag.tagName]?.imageUrl : null;
  const displayHeroImage = heroImage || defaultHeroImage;

  const currentUrl = `${window.location.origin}/tags`;
  const hreflangLinks = [
    { lang: "sr-Latn", url: currentUrl },
    { lang: "en", url: currentUrl },
    { lang: "x-default", url: currentUrl },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Explore by Tags",
    description: "Discover videos through AI-generated tags",
    url: currentUrl,
    numberOfItems: allTags.length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Explore by Tags"
        description="Discover videos through AI-generated tags. Find content by specific topics, keywords, and themes."
        path="/tags"
        canonical={currentUrl}
        hreflang={hreflangLinks}
        structuredData={structuredData}
      />
      <Header />

      <div className="h-16" />

      <div 
        className="relative h-[30vh] md:h-[50vh] flex items-end overflow-hidden"
        style={{
          background: displayHeroImage 
            ? undefined 
            : 'linear-gradient(to bottom right, hsl(var(--primary) / 0.2), hsl(var(--background)), hsl(var(--background)))'
        }}
      >
        {displayHeroImage && (
          <>
            <img
              src={displayHeroImage}
              alt="Tag hero background"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </>
        )}
        <div className="relative px-4 sm:px-8 md:px-16 pb-16 w-full z-10">
          <h1
            className="text-5xl md:text-7xl font-bold mb-4 text-foreground"
            data-testid="text-page-title"
          >
            {selectedTagData ? selectedTagData.tag.tagName : "Explore by Tags"}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
            {selectedTagData 
              ? `${selectedTagData.count} videos with this tag`
              : "Discover videos through AI-generated tags. Click any tag to see related content."
            }
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-8 md:px-16 py-8">
        <h2 className="text-2xl font-bold mb-6">Browse by Tag</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-8">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !selectedTag
                ? "bg-primary text-primary-foreground"
                : "bg-card text-card-foreground hover-elevate"
            }`}
            data-testid="button-filter-all"
          >
            All Tags ({videos.length})
          </button>
          {top20Tags.map(({ tag, count }) => {
            const hasImage = !!tagImageMap[tag.tagName];
            return (
              <button
                key={tag.id}
                onClick={() => setSelectedTag(tag.id)}
                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors overflow-hidden ${
                  selectedTag === tag.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground hover-elevate"
                }`}
                data-testid={`button-tag-${tag.id}`}
              >
                {hasImage && selectedTag !== tag.id && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/60" />
                )}
                <span className={hasImage && selectedTag !== tag.id ? "ml-3" : ""}>
                  {tag.tagName} ({count})
                </span>
              </button>
            );
          })}
          {otherTags.length > 0 && (
            <button
              onClick={() => setSelectedTag("others")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedTag === "others"
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

      <div className="px-4 sm:px-8 md:px-16 space-y-12 pb-16">
        {selectedTag === null ? (
          <VideoGrid videos={videos} title="All Videos" />
        ) : selectedTag === "others" ? (
          <VideoGrid videos={othersVideos} title="Other Tags" />
        ) : (
          <VideoGrid
            videos={videos.filter((v) =>
              v.tags?.some((t) => t.id === selectedTag)
            )}
            title={`Videos tagged "${selectedTagData?.tag.tagName}"`}
          />
        )}

        {allTags.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No tags found. AI categorization will generate tags automatically.
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
