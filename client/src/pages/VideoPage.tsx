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
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { ShareButtons } from "@/components/ShareButtons";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { VideoWithLocalizedRelations, SupportedLanguage, SeoSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function VideoPage() {
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [, params] = useRoute("/video/:slug");
  const videoSlug = params?.slug;

  // Fetch supported languages for hreflang - Moved up to avoid hook order violation
  const { data: languages = [] } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
    staleTime: Infinity,
  });

  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });
  const siteName = seoSettings?.siteName || "";

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

  const { data: similarVideos = [] } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos", video?.id, "similar", i18n.language],
    queryFn: async () => {
      if (!video?.id) return [];
      const res = await apiRequest("GET", `/api/videos/${video.id}/similar?lang=${i18n.language}`);
      return res.json();
    },
    enabled: !!video?.id,
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
              {t("nav.browse", "Browse")}
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

  const seoTitle = video.title;
  const seoDescription =
    video.description ||
    (siteName
      ? `Watch ${video.title} on ${siteName}`
      : `Watch ${video.title}`);
  const seoImage = video.thumbnailUrl || "";

  // Convert view count string to number
  const viewCountNumber = video.viewCount
    ? parseInt(video.viewCount.replace(/[,\s]/g, "").match(/\d+/)?.[0] || "0")
    : undefined;

  // Video structured data (VideoObject schema)
  const contentUrl = isTikTok
    ? `https://www.tiktok.com/@${video.channel?.name || 'user'}/video/${video.videoId}`
    : `https://www.youtube.com/watch?v=${video.videoId}`;

  // Parse duration string to seconds (supports ISO 8601 PT#M#S and HH:MM:SS / MM:SS formats)
  const parseDurationToSeconds = (dur: string | null | undefined): number | undefined => {
    if (!dur) return undefined;
    // ISO 8601: PT1H2M30S, PT5M, PT30S
    const isoMatch = dur.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (isoMatch) {
      return (parseInt(isoMatch[1] || "0") * 3600) + (parseInt(isoMatch[2] || "0") * 60) + parseInt(isoMatch[3] || "0");
    }
    // HH:MM:SS or MM:SS
    const parts = dur.split(":").map(Number);
    if (parts.length === 3 && parts.every(n => !isNaN(n))) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2 && parts.every(n => !isNaN(n))) return parts[0] * 60 + parts[1];
    return undefined;
  };

  const durationSeconds = parseDurationToSeconds(video.duration);

  const videoStructuredData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description || seoDescription,
    thumbnailUrl: [video.thumbnailUrl],
    uploadDate: video.publishDate,
    ...(durationSeconds && { duration: `PT${Math.floor(durationSeconds / 3600) > 0 ? Math.floor(durationSeconds / 3600) + "H" : ""}${Math.floor((durationSeconds % 3600) / 60)}M${durationSeconds % 60}S` }),
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
    // Speakable schema — lets voice assistants (Google Assistant) read the
    // title + description aloud. 2026 best practice for AI/voice search.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1[data-testid=\"text-video-title\"]"],
    },
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
  const origin = window.location.origin;
  
  // Construct language-specific URLs dynamically
  const hreflangLinks = languages.map(lang => {
    const prefix = lang.isDefault ? '' : `/${lang.code}`;
    return {
      lang: lang.code,
      url: `${origin}${prefix}/video/${videoSlugOrId}`
    };
  });

  // Add x-default pointing to default language (root)
  hreflangLinks.push({ 
    lang: "x-default", 
    url: `${origin}/video/${videoSlugOrId}` 
  });
  
  // Canonical should be the current page's full URL based on current language
  const currentLang = languages.find(l => l.code === i18n.language);
  const currentPrefix = currentLang?.isDefault ? '' : `/${i18n.language}`;
  // Fallback to hardcoded check if languages not loaded yet
  const effectivePrefix = currentLang ? currentPrefix : (i18n.language === 'en' ? '/en' : '');
  const currentCanonical = `${origin}${effectivePrefix}/video/${videoSlugOrId}`;

  // og:video embed URL for social media video preview
  const ogVideoUrl = isTikTok
    ? `https://www.tiktok.com/embed/v2/${video.videoId}`
    : `https://www.youtube.com/embed/${video.videoId}`;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={seoImage}
        imageAlt={video.title}
        path={`${effectivePrefix}/video/${videoSlugOrId}`}
        type="video.other"
        structuredData={combinedStructuredData}
        canonical={currentCanonical}
        hreflang={hreflangLinks}
        videoUrl={ogVideoUrl}
        videoSecureUrl={ogVideoUrl}
        videoDuration={durationSeconds}
        publishedTime={video.publishDate || undefined}
      />

      <Header />

      <main id="main-content" className="min-h-screen bg-background pt-16">
        <article>
          {/* Back button - contained width */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4">
          <Link href="/">
            <Button
              variant="ghost"
              className="gap-2 hover-elevate"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("nav.browse", "Browse")}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsPlaying(true);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Play ${video.title}`}
              >
                <img 
                  src={video.thumbnailUrl} 
                  alt={video.title} 
                  fetchPriority="high"
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
          <PageBreadcrumb items={[
            ...(video.categories && video.categories.length > 0
              ? [{ label: video.categories[0].name, href: `/category/${video.categories[0].slug || video.categories[0].id}` }]
              : []),
            { label: video.title },
          ]} />
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
                    {video.channel?.name || t("video.unknownChannel", "Unknown Channel")}
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
                      <time
                        dateTime={new Date(video.publishDate).toISOString()}
                        data-testid="text-publish-date"
                      >
                        {t("video.publishedOn", { date: video.publishDate })}
                      </time>
                    </>
                  )}
                </div>

                {/* Like button + Share */}
                <div className="flex items-center gap-3">
                  <LikeButton videoId={video.id} size="default" />
                  <ShareButtons url={`/video/${videoSlugOrId}`} title={video.title} description={video.description || undefined} />
                </div>
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
                      href={`/category/${category.slug || category.id}`}
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
                    <Link key={tag.id} href={`/tag/${encodeURIComponent(String(tag.tagName || "").trim().replace(/\s+/g, "-"))}`}>
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
                  <VideoCard key={similarVideo.id} video={similarVideo} variant="grid" />
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
      </main>

      <Footer />
    </>
  );
}
