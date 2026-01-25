import { useState } from "react";
import { X, Sparkles, ListVideo } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VideoWithRelations, Playlist } from "@shared/schema";

interface VideoDetailModalProps {
  video: VideoWithRelations | null;
  open: boolean;
  onClose: () => void;
  onCategorize?: (videoId: string) => void;
  similarVideos?: VideoWithRelations[];
}

export function VideoDetailModal({
  video,
  open,
  onClose,
  onCategorize,
  similarVideos = [],
}: VideoDetailModalProps) {
  const { toast } = useToast();

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    enabled: open,
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async ({
      playlistId,
      videoId,
    }: {
      playlistId: string;
      videoId: string;
    }) => {
      return apiRequest("POST", `/api/playlists/${playlistId}/videos`, {
        videoId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: "Success",
        description: "Video added to playlist",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add video to playlist",
        variant: "destructive",
      });
    },
  });

  const handleAddToPlaylist = (playlistId: string) => {
    if (!video) return;
    addToPlaylistMutation.mutate({ playlistId, videoId: video.id });
  };

  if (!video) return null;

  const embedUrl = `https://www.youtube.com/embed/${video.videoId}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 bg-background border-border"
        data-testid="modal-video-detail"
      >
        <div className="relative">
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-modal"
            className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm rounded-full hover-elevate"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="aspect-video w-full bg-black">
            <iframe
              src={embedUrl}
              title={video.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              data-testid="iframe-video-player"
            />
          </div>

          <div className="p-6 md:p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h2
                  className="text-2xl md:text-3xl font-bold"
                  data-testid="text-video-title"
                >
                  {video.title}
                </h2>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="button-add-to-playlist"
                        className="gap-2"
                        disabled={
                          playlists.length === 0 ||
                          addToPlaylistMutation.isPending
                        }
                      >
                        <ListVideo className="h-4 w-4" />
                        Add to Playlist
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {playlists.length === 0 ? (
                        <DropdownMenuItem disabled>
                          No playlists available
                        </DropdownMenuItem>
                      ) : (
                        playlists.map((playlist) => (
                          <DropdownMenuItem
                            key={playlist.id}
                            onClick={() => handleAddToPlaylist(playlist.id)}
                            data-testid={`menu-item-playlist-${playlist.id}`}
                          >
                            {playlist.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {onCategorize && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCategorize(video.id)}
                      data-testid="button-categorize"
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      AI Categorize
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span
                  className="font-medium text-foreground"
                  data-testid="text-channel-name"
                >
                  {video.channel.name}
                </span>
                {video.viewCount && (
                  <>
                    <span>•</span>
                    <span data-testid="text-view-count">
                      {video.viewCount} views
                    </span>
                  </>
                )}
                {video.publishDate && (
                  <>
                    <span>•</span>
                    <span data-testid="text-publish-date">
                      {video.publishDate}
                    </span>
                  </>
                )}
              </div>

              {video.description && (
                <p
                  className="text-foreground/80 leading-relaxed"
                  data-testid="text-video-description"
                >
                  {video.description}
                </p>
              )}

              {video.categories && video.categories.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Categories
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {video.categories.map((category) => (
                      <Badge
                        key={category.id}
                        variant="outline"
                        className="px-3 py-1"
                        data-testid={`badge-category-${category.id}`}
                      >
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {video.tags && video.tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    AI Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {video.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="px-3 py-1"
                        data-testid={`badge-tag-${tag.id}`}
                      >
                        {tag.tagName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {similarVideos.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-border">
                <h3 className="text-xl font-bold">Similar Videos</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {similarVideos.slice(0, 4).map((similarVideo) => (
                    <div
                      key={similarVideo.id}
                      className="cursor-pointer hover-elevate rounded-md overflow-hidden"
                      data-testid={`card-similar-${similarVideo.id}`}
                    >
                      <div className="aspect-video relative bg-muted">
                        <img
                          src={similarVideo.thumbnailUrl}
                          alt={similarVideo.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-sm font-medium line-clamp-2">
                          {similarVideo.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {similarVideo.channel.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
