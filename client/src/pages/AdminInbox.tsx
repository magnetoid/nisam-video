import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Inbox,
  MessageSquare,
  Youtube,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Bug,
  Lightbulb,
  Megaphone,
  Trash2,
  ExternalLink,
  Eye,
} from "lucide-react";

interface InboxItem {
  id: string;
  type: "suggestion" | "channel_recommendation";
  subType: string;
  subject: string;
  message: string;
  email: string | null;
  sender: string;
  ip: string | null;
  status: string;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

interface InboxResponse {
  items: InboxItem[];
  total: number;
  stats: {
    pendingChannels: number;
    totalSuggestions: number;
    totalChannelRecs: number;
  };
}

function getTypeIcon(item: InboxItem) {
  if (item.type === "channel_recommendation") return <Youtube className="h-4 w-4" />;
  switch (item.subType) {
    case "feature": return <Lightbulb className="h-4 w-4" />;
    case "bug": return <Bug className="h-4 w-4" />;
    case "channel": return <Megaphone className="h-4 w-4" />;
    default: return <Mail className="h-4 w-4" />;
  }
}

function getTypeLabel(item: InboxItem, t: (key: string, fallback: string) => string) {
  if (item.type === "channel_recommendation") return t("inbox.channelRec", "Channel Recommendation");
  switch (item.subType) {
    case "feature": return t("inbox.featureSuggestion", "Feature Suggestion");
    case "bug": return t("inbox.bugReport", "Bug Report");
    case "channel": return t("inbox.channelSuggestion", "Channel Suggestion");
    default: return t("inbox.contactMessage", "Contact Message");
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/50"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "approved":
      return <Badge variant="outline" className="text-green-500 border-green-500/50"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    case "rejected":
      return <Badge variant="outline" className="text-red-500 border-red-500/50"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline"><MessageSquare className="h-3 w-3 mr-1" />Received</Badge>;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminInbox() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [channelName, setChannelName] = useState("");

  const { data, isLoading } = useQuery<InboxResponse>({
    queryKey: ["/api/admin/inbox", activeTab],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/inbox?tab=${activeTab}&limit=100`);
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const res = await apiRequest("POST", `/api/admin/channel-recommendations/${id}/approve`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      toast({ title: t("common.success", "Success"), description: t("inbox.channelApproved", "Channel recommendation approved and added.") });
      setSelectedItem(null);
      setChannelName("");
    },
    onError: () => {
      toast({ title: t("common.error", "Error"), description: t("inbox.approveFailed", "Failed to approve."), variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/channel-recommendations/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      toast({ title: t("common.success", "Success"), description: t("inbox.channelRejected", "Channel recommendation rejected.") });
      setSelectedItem(null);
      setRejectReason("");
    },
    onError: () => {
      toast({ title: t("common.error", "Error"), description: t("inbox.rejectFailed", "Failed to reject."), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/inbox/suggestions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      toast({ title: t("common.success", "Success"), description: t("inbox.deleted", "Message deleted.") });
      setSelectedItem(null);
    },
  });

  const items = data?.items || [];
  const stats = data?.stats || { pendingChannels: 0, totalSuggestions: 0, totalChannelRecs: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Inbox className="h-6 w-6" />
          {t("inbox.title", "Inbox")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("inbox.description", "Channel recommendations, feature suggestions, and contact messages from visitors.")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingChannels}</p>
              <p className="text-xs text-muted-foreground">{t("inbox.pendingChannels", "Pending Channels")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalSuggestions}</p>
              <p className="text-xs text-muted-foreground">{t("inbox.totalSuggestions", "Suggestions & Messages")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Youtube className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalChannelRecs}</p>
              <p className="text-xs text-muted-foreground">{t("inbox.totalChannelRecs", "Channel Recommendations")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Inbox className="h-4 w-4" />
            {t("inbox.all", "All")}
            {data && <Badge variant="secondary" className="ml-1 text-xs">{data.total}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5">
            <Youtube className="h-4 w-4" />
            {t("inbox.channels", "Channels")}
            {stats.pendingChannels > 0 && <Badge className="ml-1 text-xs bg-yellow-500">{stats.pendingChannels}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {t("inbox.suggestions", "Suggestions")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t("inbox.empty", "No messages yet.")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <Card
                  key={`${item.type}-${item.id}`}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedItem(item)}
                >
                  <CardContent className="py-3 px-4 flex items-start gap-3">
                    <div className={`mt-1 p-1.5 rounded-md shrink-0 ${item.type === "channel_recommendation" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500"}`}>
                      {getTypeIcon(item)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{getTypeLabel(item, t)}</span>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="font-medium text-sm mt-0.5 truncate">
                        {item.type === "channel_recommendation" ? item.subject : item.subject || item.message.slice(0, 80)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.sender}</span>
                        {item.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{item.email}</span>}
                        <span>{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0 mt-1">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => { setSelectedItem(null); setRejectReason(""); setChannelName(""); }}>
        <DialogContent className="sm:max-w-[550px]">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTypeIcon(selectedItem)}
                  {getTypeLabel(selectedItem, t)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedItem.status)}
                  <span className="text-sm text-muted-foreground">{new Date(selectedItem.createdAt).toLocaleString()}</span>
                </div>

                {selectedItem.type === "channel_recommendation" ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("inbox.channelUrl", "Channel URL")}</label>
                      <div className="flex items-center gap-2">
                        <Input value={selectedItem.subject} readOnly className="font-mono text-sm" />
                        <a href={selectedItem.subject} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="outline"><ExternalLink className="h-4 w-4" /></Button>
                        </a>
                      </div>
                    </div>

                    {selectedItem.message && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">{t("inbox.description", "Description")}</label>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{selectedItem.message}</p>
                      </div>
                    )}

                    {selectedItem.status === "pending" && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("inbox.channelName", "Channel Name (optional)")}</label>
                          <Input
                            placeholder={t("inbox.channelNamePlaceholder", "Auto-detected from URL if empty")}
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t("inbox.rejectionReason", "Rejection Reason (if rejecting)")}</label>
                          <Textarea
                            placeholder={t("inbox.rejectionPlaceholder", "Optional reason...")}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="destructive"
                            onClick={() => rejectMutation.mutate({ id: selectedItem.id, reason: rejectReason || undefined })}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {t("inbox.reject", "Reject")}
                          </Button>
                          <Button
                            onClick={() => approveMutation.mutate({ id: selectedItem.id, name: channelName || undefined })}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {t("inbox.approve", "Approve & Add Channel")}
                          </Button>
                        </div>
                      </>
                    )}

                    {selectedItem.rejectionReason && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-red-500">{t("inbox.rejectionReason", "Rejection Reason")}</label>
                        <p className="text-sm text-muted-foreground bg-red-500/10 p-3 rounded-md">{selectedItem.rejectionReason}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">{t("inbox.subject", "Subject")}</label>
                      <p className="text-sm font-medium bg-muted p-3 rounded-md">{selectedItem.subject}</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">{t("inbox.message", "Message")}</label>
                      <p className="text-sm text-foreground/80 bg-muted p-3 rounded-md whitespace-pre-wrap">{selectedItem.message}</p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {selectedItem.email || t("inbox.noEmail", "No email provided")}
                      </span>
                      {selectedItem.ip && <span>IP: {selectedItem.ip}</span>}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(selectedItem.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t("inbox.delete", "Delete")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
