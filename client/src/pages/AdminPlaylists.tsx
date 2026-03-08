import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, ListVideo, Trash2, Edit2 } from "lucide-react";
import type { Playlist } from "@shared/schema";

export default function AdminPlaylists() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null,
  );
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data: playlists = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiRequest("POST", "/api/playlists", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setCreateOpen(false);
      setFormData({ name: "", description: "" });
      toast({
        title: t("common.success", "Success"),
        description: t("admin.playlistCreated", "Playlist created successfully"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToCreatePlaylist", "Failed to create playlist"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Playlist>;
    }) => {
      return apiRequest("PATCH", `/api/playlists/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setEditOpen(false);
      setSelectedPlaylist(null);
      setFormData({ name: "", description: "" });
      toast({
        title: t("common.success", "Success"),
        description: t("admin.playlistUpdated", "Playlist updated successfully"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToUpdatePlaylist", "Failed to update playlist"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/playlists/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: t("common.success", "Success"),
        description: t("admin.playlistDeleted", "Playlist deleted successfully"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToDeletePlaylist", "Failed to delete playlist"),
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.playlistNameRequired", "Playlist name is required"),
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!selectedPlaylist || !formData.name.trim()) return;
    updateMutation.mutate({
      id: selectedPlaylist.id,
      data: { name: formData.name, description: formData.description || null },
    });
  };

  const handleEdit = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setFormData({
      name: playlist.name,
      description: playlist.description || "",
    });
    setEditOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (
      confirm(
        t("admin.confirmDeletePlaylist", { name, defaultValue: "Are you sure you want to delete playlist \"{{name}}\"? This action cannot be undone." })
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                {t("admin.playlistManagement", "Playlist Management")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("admin.playlistManagementDesc", "Create and manage video playlists")}
              </p>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-playlist">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("admin.createPlaylist", "Create Playlist")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.createNewPlaylist", "Create New Playlist")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.createPlaylistDesc", "Add a new playlist to organize your videos")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium" htmlFor="name">
                      {t("common.name", "Name")} *
                    </label>
                    <Input
                      id="name"
                      placeholder={t("admin.enterPlaylistName", "Enter playlist name")}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      data-testid="input-playlist-name"
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium"
                      htmlFor="description"
                    >
                      {t("common.description", "Description")}
                    </label>
                    <Textarea
                      id="description"
                      placeholder={t("admin.enterPlaylistDescription", "Enter playlist description")}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      data-testid="input-playlist-description"
                    />
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-create"
                  >
                    {createMutation.isPending
                      ? t("common.creating", "Creating...")
                      : t("admin.createPlaylist", "Create Playlist")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">{t("admin.loadingPlaylists", "Loading playlists...")}</div>
            </div>
          ) : playlists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListVideo className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("admin.noPlaylists", "No Playlists")}</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {t("admin.noPlaylistsDesc", "Create your first playlist to start organizing videos")}
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("admin.createPlaylist", "Create Playlist")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {playlists.map((playlist) => (
                <Card key={playlist.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle
                          className="truncate"
                          data-testid={`text-playlist-name-${playlist.id}`}
                        >
                          {playlist.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {playlist.videoCount}{" "}
                          {playlist.videoCount === 1 ? t("common.video", "video") : t("common.videos", "videos")}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(playlist)}
                          data-testid={`button-edit-${playlist.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            handleDelete(playlist.id, playlist.name)
                          }
                          data-testid={`button-delete-${playlist.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {playlist.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {playlist.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.editPlaylist", "Edit Playlist")}</DialogTitle>
            <DialogDescription>{t("admin.editPlaylistDesc", "Update playlist information")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="edit-name">
                {t("common.name", "Name")} *
              </label>
              <Input
                id="edit-name"
                placeholder={t("admin.enterPlaylistName", "Enter playlist name")}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="edit-description">
                {t("common.description", "Description")}
              </label>
              <Textarea
                id="edit-description"
                placeholder={t("admin.enterPlaylistDescription", "Enter playlist description")}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                data-testid="input-edit-description"
              />
            </div>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="w-full"
              data-testid="button-submit-update"
            >
              {updateMutation.isPending ? t("common.updating", "Updating...") : t("admin.updatePlaylist", "Update Playlist")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
