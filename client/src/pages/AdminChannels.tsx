import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import { ChannelManagement } from "@/components/ChannelManagement";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Channel } from "@shared/schema";

export default function AdminChannels() {
  const { toast } = useToast();

  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />

      <main className="ml-60 pt-16 p-8">
        <ChannelManagement
          channels={channels}
          onAdd={(url, name) => addChannelMutation.mutate({ url, name })}
          onScrape={(id) => scrapeChannelMutation.mutate(id)}
          onDelete={(id) => deleteChannelMutation.mutate(id)}
          isLoading={scrapeChannelMutation.isPending}
        />
      </main>
    </div>
  );
}
