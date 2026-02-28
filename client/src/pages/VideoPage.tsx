import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Eye, Play, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoCard } from "@/components/VideoCard";
import { LikeButton } from "@/components/LikeButton";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { VideoWithLocalizedRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function VideoPage() {
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [, params] = useRoute("/video/:slug");
  const videoSlug = params?.slug;

  const {
    data: video,
    isLoading: videoLoading,
    error: videoError,
  } = useQuery<VideoWithLocalizedRelations>({
    queryKey: ["/api/videos", videoSlug, i18n.language],
    queryFn: async () => {
      if (!videoSlug) throw new Error("Video slug is required");
      // Use apiRequest or fetch with lang param
      const res = await apiRequest("GET", `/api/videos/${videoSlug}?lang=${i18n.language}`);
      return res.json();
    },
    enabled: !!videoSlug,
    retry: 2,
  });

  const { data: allVideos = [] } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos", i18n.language],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/videos?lang=${i18n.language}`);
      return res.json();
    },
  });

  // Track view when video is loaded
  const trackViewMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const res = await fetch(`/api/videos/${videoId}/view`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to track view");
      return res.json();
    },
  });

  useEffect(() => {
    if (video?.id) {
      trackViewMutation.mutate(video.id);
    }
  }, [video?.id]);

  if (videoLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{t("video.loading")}</p>
        </div>
      </div>
    );
  }

  if (videoError || !video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold mb-2">{t("errors.notFound")}</h1>
          {videoError && (
            <p className="text-muted-foreground">
              {videoError instanceof Error
                ? videoError.message
                : "An error occurred"}
            </p>
          )}
          <Link href="/">
            <Button
              variant="outline"
              className="gap-2"
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("nav.browse")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Determine embed URL based on video type
  const isTikTok = video.videoType === "tiktok";
  const embedUrl = isTikTok 
    ? (video.embedUrl || `https://www.tiktok.com/embed/v2/${video.videoId}`)
    : `https://www.youtube.com/embed/${video.videoId}?autoplay=1`;

  const similarVideos = allVideos
    .filter(
      (v) =>
        v.id !== video.id &&
        v.categories?.some((cat) =>
          video.categories?.some((vidCat) => vidCat.id === cat.id),
        ),
    )
    .slice(0, 6);

  const seoTitle = video.title;
  const seoDescription =
    video.description ||
    `Watch ${video.title} on nisam.video - AI-powered video aggregation hub`;
  const seoImage = video.thumbnailUrl || "";

  // Convert view count string to number
  const viewCountNumber = video.viewCount
    ? parseInt(video.viewCount.replace(/[,\s]/g, "").match(/\d+/)?.[0] || "0")
    : undefined;

  // Video structured data (VideoObject schema)
  const contentUrl = isTikTok
    ? `https://www.tiktok.com/@${video.channel?.name || 'user'}/video/${video.videoId}`
    : `https://www.youtube.com/watch?v=${video.videoId}`;

  const videoStructuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description || seoDescription,
    thumbnailUrl: [video.thumbnailUrl],
    uploadDate: video.publishDate,
    contentUrl,
    embedUrl,
    ...(viewCountNumber && {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: { "@type": "WatchAction" },
        userInteractionCount: viewCountNumber,
      },
    }),
    ...(video.channel && {
      author: {
        "@type": "Organization",
        name: video.channel.name,
        ...(video.channel.thumbnailUrl && { logo: video.channel.thumbnailUrl }),
      },
    }),
    ...(video.categories &&
      video.categories.length > 0 && {
        genre: video.categories.map((cat) => cat.name),
      }),
    ...(video.tags &&
      video.tags.length > 0 && {
        keywords: video.tags.map((tag) => tag.tagName).join(", "),
      }),
  };

  // Breadcrumb structured data
  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: window.location.origin,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: video.title,
        item: `${window.location.origin}/video/${video.slug || video.id}`,
      },
    ],
  };

  // Combine both structured data
  const combinedStructuredData = {
    "@context": "https://schema.org",
    "@graph": [videoStructuredData, breadcrumbStructuredData],
  };

  // Current URL for canonical and hreflang - use slug for SEO
  const videoSlugOrId = video.slug || video.id;
  const currentUrl = `${window.location.origin}/video/${videoSlugOrId}`;
  const hreflangLinks = [
    { lang: "sr-Latn", url: currentUrl },
    { lang: "en", url: currentUrl },
    { lang: "x-default", url: currentUrl },
  ];

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={seoImage}
        path={`/video/${videoSlugOrId}`}
        type="video.other"
        structuredData={combinedStructuredData}
        canonical={currentUrl}
        hreflang={hreflangLinks}
      />

      <Header />

      <div className="min-h-screen bg-background pt-16">
        {/* Back button - contained width */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4">
          <Link href="/">
            <Button
              variant="ghost"
              className="gap-2 hover-elevate"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("nav.browse")}
            </Button>
          </Link>
        </div>

        {/* Video player - full width */}
        <div className="w-[calc(100%-40px)] mx-auto pb-8">
          <div id="video-player-container" className="aspect-video w-full bg-black rounded-lg overflow-hidden relative group">
            {!isPlaying ? (
              <div 
                className="absolute inset-0 z-10 cursor-pointer group/overlay"
                onClick={() => setIsPlaying(true)}
              >
                <img 
                  src={video.thumbnailUrl} 
                  alt={video.title} 
                  className="w-full h-full object-cover opacity-80 transition-all duration-500 group-hover/overlay:scale-105 group-hover/overlay:opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover/overlay:opacity-80 transition-opacity duration-500" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl opacity-0 group-hover/overlay:opacity-100 transition-opacity duration-500" />
                    <Button 
                      size="lg" 
                      className="gap-2 min-w-[140px] h-16 rounded-full text-lg shadow-2xl relative z-10 transform transition-transform duration-300 group-hover/overlay:scale-110" 
                    >
                      <Play className="h-8 w-8 fill-current ml-1" /> {t("video.watch", "Watch")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <iframe
                src={embedUrl}
                title={video.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                data-testid="iframe-video-player"
              />
            )}
          </div>
        </div>

        {/* Video details - below the player */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pb-8">
          <div className="space-y-6">
            {/* Title and stats */}
            <div className="space-y-4">
              <h1
                className="text-2xl md:text-3xl font-bold"
                data-testid="text-video-title"
              >
                {video.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-1">
                  <span
                    className="font-medium text-foreground"
                    data-testid="text-channel-name"
                  >
                    {video.channel?.name || "Unknown Channel"}
                  </span>
                  {video.viewCount && (
                    <>
                      <span>•</span>
                      <span
                        data-testid="text-view-count"
                        className="flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        {t("video.views", {
                          count: parseInt(video.viewCount.replace(/,/g, "")),
                        })}
                      </span>
                    </>
                  )}
                  {video.internalViewsCount > 0 && (
                    <>
                      <span>•</span>
                      <span
                        data-testid="text-internal-views"
                        className="flex items-center gap-1"
                      >
                        {video.internalViewsCount}{" "}
                        {t("video.internalViews", {
                          count: video.internalViewsCount,
                        })}
                      </span>
                    </>
                  )}
                  {video.publishDate && (
                    <>
                      <span>•</span>
                      <span data-testid="text-publish-date">
                        {t("video.publishedOn", { date: video.publishDate })}
                      </span>
                    </>
                  )}
                </div>

                {/* Like button */}
                <LikeButton videoId={video.id} size="default" />
              </div>
            </div>

            {/* Description */}
            {video.description && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t("video.description")}
                </h3>
                <p
                  className="text-foreground/80 leading-relaxed whitespace-pre-wrap"
                  data-testid="text-video-description"
                >
                  {video.description}
                </p>
              </Card>
            )}

            {/* Categories */}
            {video.categories && video.categories.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("categories.title")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {video.categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/categories?filter=${category.id}`}
                    >
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover-elevate"
                        data-testid={`badge-category-${category.id}`}
                      >
                        {category.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {video.tags && video.tags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("video.tags")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag) => (
                    <Link key={tag.id} href={`/tags?filter=${tag.id}`}>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover-elevate"
                        data-testid={`badge-tag-${tag.id}`}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {tag.tagName}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Similar videos below - full width grid */}
          {similarVideos.length > 0 && (
            <div className="mt-12 space-y-6">
              <h2 className="text-2xl font-bold">{t("video.similarVideos")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                {similarVideos.map((similarVideo) => (
                  <VideoCard key={similarVideo.id} video={similarVideo} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
