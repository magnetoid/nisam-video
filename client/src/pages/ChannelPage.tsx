import { useEffect, useMemo } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { VideoGrid } from "@/components/VideoGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { getOptimizedImageUrl } from "@/lib/image";
import type { Channel, VideoWithLocalizedRelations } from "@shared/schema";

export default function ChannelPage() {
  const { t, i18n } = useTranslation();
  const [, params] = useRoute("/channels/:slug");
  const [, setLocation] = useLocation();
  const slugOrId = params?.slug;

  const channelId = useMemo(() => {
    if (!slugOrId) return undefined;
    const uuidMatch = slugOrId.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    return uuidMatch?.[0] || slugOrId;
  }, [slugOrId]);

  const {
    data: channel,
    isLoading: channelLoading,
    error: channelError,
  } = useQuery<Channel>({
    queryKey: ["/api/channels", channelId],
    queryFn: async () => {
      if (!channelId) throw new Error("Channel id is required");
      const res = await apiRequest("GET", `/api/channels/${channelId}`);
      return res.json();
    },
    enabled: !!channelId,
    retry: 1,
  });

  const canonicalSlug = useMemo(() => {
    if (!channel) return undefined;
    const base = (channel.name || "")
      .toLowerCase()
      .trim()
      .replace(/č/g, "c")
      .replace(/ć/g, "c")
      .replace(/đ/g, "dj")
      .replace(/š/g, "s")
      .replace(/ž/g, "z")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "")
      .slice(0, 80);
    return `${base}-${channel.id}`;
  }, [channel]);

  useEffect(() => {
    if (!canonicalSlug || !slugOrId) return;
    if (slugOrId !== canonicalSlug) {
      setLocation(`/channels/${canonicalSlug}`);
    }
  }, [canonicalSlug, setLocation, slugOrId]);

  const {
    data: videos = [],
    isLoading: videosLoading,
    error: videosError,
    refetch: refetchVideos,
  } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos", "channel", channelId, i18n.language],
    queryFn: async () => {
      if (!channelId) throw new Error("Channel id is required");
      const res = await apiRequest(
        "GET",
        `/api/videos?channelId=${encodeURIComponent(channelId)}&limit=96&lang=${encodeURIComponent(i18n.language)}`,
      );
      return res.json();
    },
    enabled: !!channelId,
    staleTime: 60 * 1000,
  });

  const pageTitle = channel?.name ? channel.name : t("nav.channels");

  const heroSubtitle = useMemo(() => {
    if (!channel) return "";
    if (typeof channel.videoCount === "number" && channel.videoCount > 0) {
      return t("channelsDirectory.videosCount", { count: channel.videoCount });
    }
    if (channel.platform === "tiktok") return "TikTok";
    return "YouTube";
  }, [channel, t]);

  const description = useMemo(() => {
    const raw = (channel as any)?.description;
    return typeof raw === "string" ? raw.trim() : "";
  }, [channel]);

  const heroImage = useMemo(() => {
    const url = channel?.bannerUrl || channel?.thumbnailUrl;
    if (!url) return null;
    return getOptimizedImageUrl(url, 1920);
  }, [channel]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO title={pageTitle} description={t("channelPage.videosTitle")} />
      <Header />

      <main className="pt-16">
        <div className="relative h-[44vh] md:h-[62vh] overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage}
              alt={pageTitle}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-background to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/35 to-transparent" />

          <div className="relative h-full flex items-end px-4 sm:px-8 md:px-12 pb-10">
            <div className="max-w-3xl space-y-4">
              <Link href="/channels">
                <Button variant="ghost" className="pl-0" type="button">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("channelPage.back")}
                </Button>
              </Link>

              <div className="space-y-3">
                {channel?.platform && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {channel.platform === "tiktok" ? "TikTok" : "YouTube"}
                    </Badge>
                    {heroSubtitle && <span className="text-sm text-muted-foreground">{heroSubtitle}</span>}
                  </div>
                )}

                <h1 className="text-4xl md:text-6xl font-bold tracking-tight break-words">
                  {channelLoading ? t("nav.channels") : pageTitle}
                </h1>

                {description && (
                  <p className="text-sm md:text-base text-muted-foreground max-w-2xl text-clamp-2">
                    {description}
                  </p>
                )}

                {channel?.url && (
                  <div>
                    <a href={channel.url} target="_blank" rel="noreferrer">
                      <Button className="gap-2" type="button">
                        <ExternalLink className="h-4 w-4" />
                        {t("channelPage.openExternal")}
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="px-4 sm:px-8 md:px-12 py-10 space-y-6">
          {channelError && (
            <div className="max-w-xl rounded-lg border border-border bg-muted/30 p-6">
              <div className="text-lg font-semibold">{t("channelsDirectory.errorTitle")}</div>
              <div className="text-sm text-muted-foreground mt-2">
                {channelError instanceof Error ? channelError.message : String(channelError)}
              </div>
            </div>
          )}

          {!channelError && videosError && (
            <div className="max-w-xl rounded-lg border border-border bg-muted/30 p-6">
              <div className="text-lg font-semibold">{t("channelsDirectory.errorTitle")}</div>
              <div className="text-sm text-muted-foreground mt-2">
                {videosError instanceof Error ? videosError.message : String(videosError)}
              </div>
              <div className="mt-4">
                <Button onClick={() => refetchVideos()} type="button">
                  {t("channelsDirectory.retry")}
                </Button>
              </div>
            </div>
          )}

          {!channelError && !videosError && (
            <VideoGrid
              videos={videos}
              title={t("channelPage.videosTitle")}
              isLoading={videosLoading}
            />
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
