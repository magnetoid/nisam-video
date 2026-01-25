import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import type { Channel } from "@shared/schema";

export default function AdminTikTok() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const { data: profiles = [], isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/tiktok-profiles"],
  });

  const addProfileMutation = useMutation({
    mutationFn: async ({ url, name }: { url: string; name: string }) => {
      return apiRequest("POST", "/api/tiktok-profiles", { url, name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tiktok-profiles"] });
      setDialogOpen(false);
      setUrl("");
      setName("");
      toast({
        title: "Profile added",
        description: "TikTok profile has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add TikTok profile",
        variant: "destructive",
      });
    },
  });

  const scrapeProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      return apiRequest("POST", `/api/tiktok-profiles/${profileId}/scrape`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tiktok-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Scraping started",
        description: "TikTok profile is being scraped for videos",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to scrape TikTok profile",
        variant: "destructive",
      });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      return apiRequest("DELETE", `/api/tiktok-profiles/${profileId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tiktok-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Profile deleted",
        description: "TikTok profile and its videos have been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete TikTok profile",
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if (url.trim() && name.trim()) {
      addProfileMutation.mutate({ url: url.trim(), name: name.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />

      <main className="ml-60 pt-16 p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                TikTok Profiles
              </h1>
              <p className="text-muted-foreground mt-1">
                Add and manage TikTok profiles for video aggregation
              </p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              data-testid="button-add-profile"
              className="gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Profile
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <SiTiktok className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3
                className="text-lg font-semibold mb-2"
                data-testid="text-empty-state"
              >
                No TikTok profiles added yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Add your first TikTok profile to start aggregating videos
              </p>
              <Button
                onClick={() => setDialogOpen(true)}
                data-testid="button-add-first-profile"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Profile
              </Button>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Videos</TableHead>
                    <TableHead>Last Scraped</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow
                      key={profile.id}
                      data-testid={`row-profile-${profile.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {profile.thumbnailUrl ? (
                            <img
                              src={profile.thumbnailUrl}
                              alt={profile.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <SiTiktok className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div
                              className="font-medium"
                              data-testid="text-profile-name"
                            >
                              {profile.name}
                            </div>
                            <a
                              href={profile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                              data-testid="link-profile-url"
                            >
                              View on TikTok
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid="badge-video-count">
                          {profile.videoCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-sm text-muted-foreground"
                          data-testid="text-last-scraped"
                        >
                          {profile.lastScraped
                            ? new Date(profile.lastScraped).toLocaleDateString()
                            : "Never"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => scrapeProfileMutation.mutate(profile.id)}
                            disabled={scrapeProfileMutation.isPending}
                            data-testid={`button-scrape-${profile.id}`}
                            className="gap-2"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${scrapeProfileMutation.isPending ? "animate-spin" : ""}`}
                            />
                            Scrape
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteProfileMutation.mutate(profile.id)}
                            data-testid={`button-delete-${profile.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add TikTok Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Profile Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., My TikTok"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-profile-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Profile URL</Label>
                <Input
                  id="url"
                  placeholder="https://www.tiktok.com/@username"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  data-testid="input-profile-url"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!url.trim() || !name.trim() || addProfileMutation.isPending}
                data-testid="button-submit-profile"
              >
                {addProfileMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Add Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
