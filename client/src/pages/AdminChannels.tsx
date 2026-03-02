import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChannelManagement } from "@/components/ChannelManagement";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Channel, ChannelRecommendation } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";

export default function AdminChannels() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"channels" | "recommendations">(
    "channels",
  );
  const [recommendationStatus, setRecommendationStatus] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    id: string | null;
    reason: string;
  }>({ open: false, id: null, reason: "" });

  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const { data: recommendations = [], isLoading: recsLoading } =
    useQuery<ChannelRecommendation[]>({
      queryKey: ["/api/admin/channel-recommendations", { status: recommendationStatus }],
      queryFn: async () => {
        const status = recommendationStatus === "all" ? undefined : recommendationStatus;
        const q = status ? `?status=${encodeURIComponent(status)}` : "";
        const res = await apiRequest(
          "GET",
          `/api/admin/channel-recommendations${q}`,
        );
        return res.json();
      },
    });

  const addChannelMutation = useMutation({
    mutationFn: async ({ url, name }: { url: string; name: string }) => {
      return apiRequest("POST", "/api/channels", { url, name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      toast({
        title: "Channel added",
        description: "YouTube channel has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add channel",
        variant: "destructive",
      });
    },
  });

  const scrapeChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return apiRequest("POST", `/api/channels/${channelId}/scrape`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Scraping started",
        description: "Channel is being scraped for videos",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start scraping",
        variant: "destructive",
      });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return apiRequest("DELETE", `/api/channels/${channelId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Channel deleted",
        description: "Channel and its videos have been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete channel",
        variant: "destructive",
      });
    },
  });

  const approveRecommendationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/channel-recommendations/${id}/approve`,
        {},
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channel-recommendations"] });
      toast({ title: "Approved", description: "Channel was added to Channels." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve recommendation",
        variant: "destructive",
      });
    },
  });

  const rejectRecommendationMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/channel-recommendations/${id}/reject`,
        { reason },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channel-recommendations"] });
      toast({ title: "Rejected" });
      setRejectDialog({ open: false, id: null, reason: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject recommendation",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Channel Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage channels and review community recommendations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <ChannelManagement
            channels={channels}
            onAdd={(url, name) => addChannelMutation.mutate({ url, name })}
            onScrape={(id) => scrapeChannelMutation.mutate(id)}
            onDelete={(id) => deleteChannelMutation.mutate(id)}
            isLoading={scrapeChannelMutation.isPending || isLoading}
          />
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Recommended Channels</h2>
              <p className="text-sm text-muted-foreground">
                Approve to add to Channels, or reject.
              </p>
            </div>
            <Select
              value={recommendationStatus}
              onValueChange={(v) => setRecommendationStatus(v as any)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[260px]">URL</TableHead>
                    <TableHead className="min-w-[260px]">Description</TableHead>
                    <TableHead className="whitespace-nowrap">Submitted</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : recommendations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        No recommendations.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recommendations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {r.url}
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.description || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.createdAt as any), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {r.status}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveRecommendationMutation.mutate(r.id)}
                              disabled={
                                r.status !== "pending" ||
                                approveRecommendationMutation.isPending
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setRejectDialog({ open: true, id: r.id, reason: "" })
                              }
                              disabled={r.status !== "pending"}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          setRejectDialog((s) => ({ ...s, open, id: open ? s.id : null }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject recommendation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((s) => ({ ...s, reason: e.target.value }))
                }
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectDialog({ open: false, id: null, reason: "" })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!rejectDialog.id) return;
                  rejectRecommendationMutation.mutate({
                    id: rejectDialog.id,
                    reason: rejectDialog.reason,
                  });
                }}
                disabled={rejectRecommendationMutation.isPending || !rejectDialog.id}
              >
                {rejectRecommendationMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
