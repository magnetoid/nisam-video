import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import { VideoManagement } from "@/components/VideoManagement";
import { VideoDetailModal } from "@/components/VideoDetailModal";
import { EditVideoDialog } from "@/components/EditVideoDialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  VideoWithRelations,
  Channel,
  Category,
  Playlist,
} from "@shared/schema";

export default function AdminVideos() {
  const { toast } = useToast();
  const [selectedVideo, setSelectedVideo] = useState<VideoWithRelations | null>(
    null,
  );
  const [editingVideo, setEditingVideo] = useState<VideoWithRelations | null>(
    null,
  );
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [processingVideoIds, setProcessingVideoIds] = useState<Set<string>>(
    new Set(),
  );
  const [channelFilter, setChannelFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  const { data: videos = [] } = useQuery<VideoWithRelations[]>({
    queryKey: ["/api/videos", channelFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channelFilter) params.append("channelId", channelFilter);
      if (categoryFilter) params.append("categoryId", categoryFilter);
      const url = `/api/videos${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch videos");
      return response.json();
    },
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
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

  const categorizeVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      setProcessingVideoIds((prev) => new Set(prev).add(videoId));
      return apiRequest("POST", `/api/videos/${videoId}/categorize`, {});
    },
    onSuccess: (_, videoId) => {
      setProcessingVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "AI Categorization complete",
        description: "Video has been categorized and tagged",
      });
    },
    onError: (_, videoId) => {
      setProcessingVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      toast({
        title: "Error",
        description: "Failed to categorize video",
        variant: "destructive",
      });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      return apiRequest("DELETE", `/api/videos/${videoId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Video deleted",
        description: "Video has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive",
      });
    },
  });

  const editVideoMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { description: string; categoryIds: string[]; tags: string[] };
    }) => {
      return apiRequest("PATCH", `/api/videos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditingVideo(null);
      toast({
        title: "Video updated",
        description: "Video has been successfully updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update video",
        variant: "destructive",
      });
    },
  });

  const bulkCategorizeMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      return apiRequest("POST", "/api/videos/bulk/categorize", { videoIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setSelectedVideoIds([]);
      toast({
        title: "Bulk categorization complete",
        description: `Successfully categorized ${data.successful} of ${data.total} videos. ${data.failed > 0 ? `Failed: ${data.failed}` : ""}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to bulk categorize videos",
        variant: "destructive",
      });
    },
  });

  const bulkTagMutation = useMutation({
    mutationFn: async ({
      videoIds,
      tags,
    }: {
      videoIds: string[];
      tags: string[];
    }) => {
      return apiRequest("POST", "/api/videos/bulk/tag", { videoIds, tags });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setSelectedVideoIds([]);
      toast({
        title: "Bulk tagging complete",
        description: `Successfully tagged ${data.successful} of ${data.total} videos. ${data.failed > 0 ? `Failed: ${data.failed}` : ""}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to bulk tag videos",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      return apiRequest("DELETE", "/api/videos/bulk", { videoIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setSelectedVideoIds([]);
      toast({
        title: "Bulk deletion complete",
        description: `Successfully deleted ${data.successful} of ${data.total} videos. ${data.failed > 0 ? `Failed: ${data.failed}` : ""}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to bulk delete videos",
        variant: "destructive",
      });
    },
  });

  const handleToggleSelect = (videoId: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId],
    );
  };

  const handleSelectAll = () => {
    setSelectedVideoIds(videos.map((v) => v.id));
  };

  const handleDeselectAll = () => {
    setSelectedVideoIds([]);
  };

  const handleBulkCategorize = () => {
    if (selectedVideoIds.length === 0) return;
    bulkCategorizeMutation.mutate(selectedVideoIds);
  };

  const handleBulkTag = (tags: string[]) => {
    if (selectedVideoIds.length === 0) return;
    bulkTagMutation.mutate({ videoIds: selectedVideoIds, tags });
  };

  const handleBulkDelete = () => {
    if (selectedVideoIds.length === 0) return;
    if (
      confirm(
        `Are you sure you want to delete ${selectedVideoIds.length} videos? This action cannot be undone.`,
      )
    ) {
      bulkDeleteMutation.mutate(selectedVideoIds);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />

      <main className="ml-60 pt-16 p-8">
        <VideoManagement
          videos={videos}
          channels={channels}
          categories={categories}
          playlists={playlists}
          selectedVideoIds={selectedVideoIds}
          selectedChannelId={channelFilter}
          selectedCategoryId={categoryFilter}
          onView={setSelectedVideo}
          onEdit={setEditingVideo}
          onCategorize={(id) => categorizeVideoMutation.mutate(id)}
          onDelete={(id) => deleteVideoMutation.mutate(id)}
          onAddToPlaylist={(videoId, playlistId) =>
            addToPlaylistMutation.mutate({ videoId, playlistId })
          }
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBulkCategorize={handleBulkCategorize}
          onBulkTag={handleBulkTag}
          onBulkDelete={handleBulkDelete}
          onChannelFilterChange={setChannelFilter}
          onCategoryFilterChange={setCategoryFilter}
          processingVideoIds={processingVideoIds}
          isBulkProcessing={
            bulkCategorizeMutation.isPending ||
            bulkTagMutation.isPending ||
            bulkDeleteMutation.isPending
          }
        />
      </main>

      <VideoDetailModal
        video={selectedVideo}
        open={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onCategorize={(id) => categorizeVideoMutation.mutate(id)}
        similarVideos={videos
          .filter((v) => v.id !== selectedVideo?.id)
          .slice(0, 4)}
      />

      <EditVideoDialog
        video={editingVideo}
        categories={categories}
        open={!!editingVideo}
        onClose={() => setEditingVideo(null)}
        onSave={(data) => {
          if (editingVideo) {
            editVideoMutation.mutate({ id: editingVideo.id, data });
          }
        }}
        isSaving={editVideoMutation.isPending}
      />
    </div>
  );
}
