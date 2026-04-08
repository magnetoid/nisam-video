import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import { VideoManagement } from "@/components/VideoManagement";
import { VideoDetailModal } from "@/components/VideoDetailModal";
import { EditVideoDialog } from "@/components/EditVideoDialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import type {
  VideoWithRelations,
  Channel,
  Category,
  Playlist,
} from "@shared/schema";

export default function AdminVideos() {
  const { t } = useTranslation();
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setPage(1);
    setSelectedVideoIds([]);
  }, [channelFilter, categoryFilter]);

  useEffect(() => {
    setSelectedVideoIds([]);
  }, [page, pageSize]);

  const { data: videos = [], isLoading: videosLoading, isFetching: videosFetching } = useQuery<VideoWithRelations[]>({
    queryKey: ["/api/videos", channelFilter, categoryFilter, page, pageSize, "createdAt"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channelFilter) params.append("channelId", channelFilter);
      if (categoryFilter) params.append("categoryId", categoryFilter);
      params.append("limit", String(pageSize));
      params.append("offset", String((page - 1) * pageSize));
      params.append("sort", "createdAt");
      const url = `/api/videos?${params.toString()}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch videos");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    placeholderData: (prev) => prev,
  });

  const hasNextPage = useMemo(() => videos.length === pageSize, [videos.length, pageSize]);

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
        title: t("common.success", "Success"),
        description: t("admin.videoAddedToPlaylist", "Video added to playlist"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToAddVideoToPlaylist", "Failed to add video to playlist"),
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
        title: t("admin.categorizationComplete", "AI Categorization complete"),
        description: t("admin.videoCategorized", "Video has been categorized and tagged"),
      });
    },
    onError: (_, videoId) => {
      setProcessingVideoIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToCategorizeVideo", "Failed to categorize video"),
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
        title: t("admin.videoDeleted", "Video deleted"),
        description: t("admin.videoRemoved", "Video has been removed"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToDeleteVideo", "Failed to delete video"),
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
        title: t("admin.videoUpdated", "Video updated"),
        description: t("admin.videoSuccessfullyUpdated", "Video has been successfully updated"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToUpdateVideo", "Failed to update video"),
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
        title: t("admin.bulkCategorizationComplete", "Bulk categorization complete"),
        description: t("admin.bulkCategorizationDesc", { successful: data.successful, total: data.total, failed: data.failed, defaultValue: "Successfully categorized {{successful}} of {{total}} videos. Failed: {{failed}}" }),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToBulkCategorize", "Failed to bulk categorize videos"),
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
        title: t("admin.bulkTaggingComplete", "Bulk tagging complete"),
        description: t("admin.bulkTaggingDesc", { successful: data.successful, total: data.total, failed: data.failed, defaultValue: "Successfully tagged {{successful}} of {{total}} videos. Failed: {{failed}}" }),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToBulkTag", "Failed to bulk tag videos"),
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
        title: t("admin.bulkDeletionComplete", "Bulk deletion complete"),
        description: t("admin.bulkDeletionDesc", { successful: data.successful, total: data.total, failed: data.failed, defaultValue: "Successfully deleted {{successful}} of {{total}} videos. Failed: {{failed}}" }),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToBulkDelete", "Failed to bulk delete videos"),
        variant: "destructive",
      });
    },
  });

  const categorizeMissingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/videos/bulk/categorize-missing", { limit: 60 });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: t("admin.categorizationComplete", "AI Categorization complete"),
        description: t("admin.categorizeMissingDesc", { successful: data.successful, total: data.total, failed: data.failed, defaultValue: "Categorized {{successful}} of {{total}} missing videos. Failed: {{failed}}" }),
      });
    },
    onError: (error: any) => {
      const message = error?.message || t("admin.failedToCategorizeMissing", "Failed to categorize missing videos");
      toast({
        title: t("common.error", "Error"),
        description: message,
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
        t("admin.confirmBulkDelete", { count: selectedVideoIds.length, defaultValue: "Are you sure you want to delete {{count}} videos? This action cannot be undone." })
      )
    ) {
      bulkDeleteMutation.mutate(selectedVideoIds);
    }
  };

  return (
    <>
      <VideoManagement
        videos={videos}
        channels={channels}
        categories={categories}
        playlists={playlists}
        selectedVideoIds={selectedVideoIds}
        selectedChannelId={channelFilter}
        selectedCategoryId={categoryFilter}
        page={page}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        isLoading={videosLoading || videosFetching}
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
        onCategorizeMissing={() => categorizeMissingMutation.mutate()}
        onChannelFilterChange={setChannelFilter}
        onCategoryFilterChange={setCategoryFilter}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        processingVideoIds={processingVideoIds}
        isBulkProcessing={
          bulkCategorizeMutation.isPending ||
          bulkTagMutation.isPending ||
          bulkDeleteMutation.isPending
        }
        isCategorizeMissingProcessing={categorizeMissingMutation.isPending}
      />

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
        video={editingVideo as any}
        categories={categories as any}
        open={!!editingVideo}
        onClose={() => setEditingVideo(null)}
        onSave={(data) => {
          if (editingVideo) {
            editVideoMutation.mutate({ id: editingVideo.id, data });
          }
        }}
        isSaving={editVideoMutation.isPending}
      />
    </>
  );
}
