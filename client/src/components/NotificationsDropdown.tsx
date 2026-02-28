import { useQuery } from "@tanstack/react-query";
import { Bell, Clock } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import type { VideoWithLocalizedRelations } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { enUS, srLatn } from "date-fns/locale";

export function NotificationsDropdown() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "sr-Latn" ? srLatn : enUS;

  const { data: recentVideos = [] } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos/recent", 5],
    queryFn: async () => {
      // Fetch specifically sorted by creation time (scraped time)
      const res = await apiRequest("GET", `/api/videos?limit=5&sort=createdAt&lang=${i18n.language}`);
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative hover-elevate active-elevate-2 min-h-[44px] min-w-[44px]"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {recentVideos.length > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600 animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t("notifications.latestVideos", "Latest Videos")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recentVideos.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t("notifications.empty", "No new videos")}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {recentVideos.map((video) => (
              <DropdownMenuItem key={video.id} asChild className="cursor-pointer p-2">
                <Link href={`/video/${video.slug || video.id}`}>
                  <div className="flex gap-3 w-full">
                    <div className="relative w-16 h-10 flex-shrink-0 rounded overflow-hidden bg-muted">
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium line-clamp-1">{video.title}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(video.createdAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
