import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import HeroImageSlider from "@/components/HeroImageSlider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

type Channel = {
  id: string;
  slug?: string;
  name: string;
  url: string;
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  platform?: string | null;
  videoCount?: number | null;
};

function buildChannelSlug(channel: Pick<Channel, "id" | "name" | "slug">) {
  if (channel.slug) return channel.slug;
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
}

function ChannelGridCard({ channel }: { channel: Channel }) {
  const { t } = useTranslation();
  const label = channel.name || "Channel";
  const initial = label.trim().slice(0, 1).toUpperCase() || "C";
  const slug = buildChannelSlug(channel);
  const description = (channel.description || "").trim();
  const backgroundImage = channel.bannerUrl || channel.thumbnailUrl || null;
  const subtitle =
    typeof channel.videoCount === "number" && channel.videoCount > 0
      ? t("channelsDirectory.videosCount", { count: channel.videoCount })
      : channel.platform === "tiktok"
        ? "TikTok"
        : "YouTube";

  return (
    <div className="group relative w-full" data-testid={`card-channel-${channel.id}`}>
      <Link href={`/channels/${slug}`}>
        <div className="cursor-pointer transition-all duration-200 ease-out will-change-transform group-hover:scale-[1.02]">
          <div className="relative aspect-video rounded-md overflow-hidden bg-muted border border-border group-hover:border-primary/40 transition-colors">
            {backgroundImage ? (
              <img
                src={backgroundImage}
                alt={label}
                className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-80"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-muted to-background" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/65 via-transparent to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground truncate">{label}</div>
                  <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                  {description && (
                    <div className="mt-1 text-xs text-muted-foreground text-clamp-2">{description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {channel.platform && (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      {channel.platform === "tiktok" ? "TikTok" : "YouTube"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{label}</div>
              <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="min-h-[40px] min-w-[40px]"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(channel.url, "_blank", "noreferrer");
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function Channels() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const { data, isLoading, error, refetch } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/channels");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const channels = data || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = channels
      .filter((c) => (c.name || "").toLowerCase().includes(q))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return base;
  }, [channels, query]);

  const heroItems = useMemo(() => {
    const sorted = [...channels]
      .filter((c) => !!c.name)
      .sort((a, b) => (b.videoCount || 0) - (a.videoCount || 0));
    return sorted.slice(0, 5).map((c) => ({
      id: c.id,
      title: c.name,
      imageUrl: c.thumbnailUrl || null,
    }));
  }, [channels]);

  const pageTitle = t("nav.channels");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO title={pageTitle} description={t("channelsDirectory.subtitle")} />
      <Header />

      <main className="pt-16">
        <HeroImageSlider items={heroItems} ariaLabel={pageTitle} />

        <section className="px-4 md:px-12 py-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{pageTitle}</h1>
              <p className="text-muted-foreground mt-2">{t("channelsDirectory.subtitle")}</p>
            </div>

            <div className="w-full md:w-[380px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("channelsDirectory.searchPlaceholder")}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="w-full aspect-video rounded-md" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="max-w-xl rounded-lg border border-border bg-muted/30 p-6">
              <div className="text-lg font-semibold">{t("channelsDirectory.errorTitle")}</div>
              <div className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : String(error)}
              </div>
              <div className="mt-4">
                <Button onClick={() => refetch()} type="button">
                  {t("channelsDirectory.retry")}
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-10 text-center">
              <div className="text-xl font-semibold">{t("channelsDirectory.emptyTitle")}</div>
              <div className="text-sm text-muted-foreground mt-2">{t("channelsDirectory.emptyBody")}</div>
            </div>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
              {filtered.map((c) => (
                <ChannelGridCard key={c.id} channel={c} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
