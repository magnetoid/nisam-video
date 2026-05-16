import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { Channel } from "@shared/schema";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, Metric, Text, Flex } from "@tremor/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ExternalLink, Sparkles } from "lucide-react";
import {
  PLATFORM_CONFIG,
  PLATFORM_ORDER,
  type PlatformKey,
} from "@/lib/platform-config";

interface SourceStat {
  platform: string;
  channelCount: number;
  videoCount: number;
}

interface XVideoPreview {
  ok: boolean;
  tweetId: string;
  permanentUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string | null;
  durationSeconds: number | null;
  publishDate: string | null;
  author: {
    screenName: string | null;
    name: string | null;
  };
}

export default function AdminSources() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PlatformKey>("youtube");

  const { data: statsResp } = useQuery<{ stats: SourceStat[] }>({
    queryKey: ["/api/admin/sources/stats"],
  });
  const stats = statsResp?.stats ?? [];
  const statFor = (p: PlatformKey): SourceStat =>
    stats.find((s) => s.platform === p) ?? { platform: p, channelCount: 0, videoCount: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("admin.sources.title", "Sources")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t(
            "admin.sources.subtitle",
            "Manage video sources across YouTube, X, TikTok, and Instagram.",
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PLATFORM_ORDER.map((p) => {
          const { label, icon: Icon } = PLATFORM_CONFIG[p];
          const s = statFor(p);
          return (
            <Card key={p} decoration="top" decorationColor={p === activeTab ? "indigo" : "gray"}>
              <Flex justifyContent="start" className="space-x-3">
                <Icon className="w-6 h-6 text-muted-foreground" />
                <div>
                  <Text>{label}</Text>
                  <Metric className="text-2xl">{s.videoCount}</Metric>
                  <Text className="text-xs">{s.channelCount} channels</Text>
                </div>
              </Flex>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PlatformKey)}>
        <TabsList className="grid w-full grid-cols-4">
          {PLATFORM_ORDER.map((p) => {
            const { label, icon: Icon } = PLATFORM_CONFIG[p];
            return (
              <TabsTrigger key={p} value={p} data-testid={`tab-source-${p}`}>
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="youtube">
          <PlatformChannels platform="youtube" />
        </TabsContent>
        <TabsContent value="x">
          <XSourceTab />
        </TabsContent>
        <TabsContent value="tiktok">
          <PlatformChannels platform="tiktok" />
        </TabsContent>
        <TabsContent value="instagram">
          <ComingSoonTab platform="instagram" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlatformChannels({ platform }: { platform: "youtube" | "tiktok" }) {
  const { t } = useTranslation();
  // Per-platform query — server-side filter avoids pulling the full channel
  // list into the client just to filter it back down.
  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels", { platform }],
  });

  const adminPath = platform === "tiktok" ? "/admin/tiktok" : "/admin/channels";

  return (
    <Card className="mt-4">
      <Flex justifyContent="between" alignItems="center">
        <div>
          <Text>{t("admin.sources.channelsCount", "Channels")}</Text>
          <Metric>{channels.length}</Metric>
        </div>
        <Link href={adminPath}>
          <Button variant="outline" size="sm" data-testid={`button-manage-${platform}`}>
            {t("admin.sources.manage", "Manage")}
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
        </Link>
      </Flex>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : channels.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {t(
            "admin.sources.empty",
            "No channels yet. Use the Manage button to add the first one.",
          )}
        </div>
      ) : (
        <>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.sources.name", "Name")}</TableHead>
                <TableHead>{t("admin.sources.url", "URL")}</TableHead>
                <TableHead className="text-right">{t("admin.sources.videos", "Videos")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.slice(0, 50).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[280px]">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {c.url}
                    </a>
                  </TableCell>
                  <TableCell className="text-right">{c.videoCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {channels.length > 50 && (
            <Text className="mt-3 text-xs text-muted-foreground">
              {t(
                "admin.sources.truncated",
                "Showing first 50 of {{count}} — use Manage for the full list.",
                { count: channels.length },
              )}
            </Text>
          )}
        </>
      )}
    </Card>
  );
}

function XSourceTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<XVideoPreview | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (tweetUrl: string): Promise<XVideoPreview> => {
      const res = await apiRequest("POST", "/api/admin/x/preview", { url: tweetUrl });
      return res.json();
    },
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (err: any) => {
      setPreview(null);
      toast({
        title: t("admin.sources.x.previewFailed", "Could not load tweet"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (tweetUrl: string) => {
      const res = await apiRequest("POST", "/api/admin/x/videos", { url: tweetUrl });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("admin.sources.x.added", "Video added"),
        description: t(
          "admin.sources.x.addedDesc",
          "The X video has been imported successfully.",
        ),
      });
      setUrl("");
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources/stats"] });
    },
    onError: (err: any) => {
      toast({
        title: t("admin.sources.x.addFailed", "Could not add video"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    // Clear the preview when the URL changes so we never show a preview that
    // doesn't match what "Add" will import.
    if (preview) setPreview(null);
  };

  const handlePreview = () => {
    if (!url.trim()) return;
    previewMutation.mutate(url.trim());
  };

  const handleAdd = () => {
    if (!preview || !url.trim()) return;
    createMutation.mutate(url.trim());
  };

  return (
    <Card className="mt-4 space-y-4">
      <div>
        <Flex justifyContent="start" className="space-x-2 mb-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <Text className="font-medium">
            {t("admin.sources.x.title", "Add a single X video by URL")}
          </Text>
        </Flex>
        <Text className="text-sm text-muted-foreground">
          {t(
            "admin.sources.x.help",
            "Paste a public X (Twitter) post URL containing a video. Photo-only and text-only posts are rejected.",
          )}
        </Text>
      </div>

      <div className="space-y-2">
        <Label htmlFor="x-url">{t("admin.sources.x.urlLabel", "Tweet URL")}</Label>
        <div className="flex space-x-2">
          <Input
            id="x-url"
            placeholder="https://x.com/username/status/1234567890"
            value={url}
            onChange={handleUrlChange}
            data-testid="input-x-tweet-url"
          />
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!url.trim() || previewMutation.isPending}
            data-testid="button-x-preview"
          >
            {previewMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("admin.sources.x.preview", "Preview")
            )}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="border rounded-md p-4 space-y-3">
          <div className="flex space-x-4">
            {preview.thumbnailUrl && (
              <img
                src={preview.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-32 h-32 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <Text className="font-medium truncate">{preview.title}</Text>
              <Text className="text-xs text-muted-foreground">
                {preview.author?.name
                  ? `${preview.author.name} (@${preview.author.screenName ?? "?"})`
                  : `@${preview.author?.screenName ?? "?"}`}
              </Text>
              {preview.durationSeconds !== null && (
                <Text className="text-xs text-muted-foreground">
                  {Math.round(preview.durationSeconds)}s
                </Text>
              )}
              <Text className="text-sm mt-2 line-clamp-3">{preview.description}</Text>
            </div>
          </div>
          <Flex justifyContent="end">
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              data-testid="button-x-add-video"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t("admin.sources.x.add", "Add video")}
            </Button>
          </Flex>
        </div>
      )}
    </Card>
  );
}

function ComingSoonTab({ platform }: { platform: "instagram" }) {
  const { t } = useTranslation();
  const cfg = PLATFORM_CONFIG[platform];
  const Icon = cfg.icon;
  return (
    <Card className="mt-4 py-16 text-center">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
      <Metric>{cfg.label}</Metric>
      <Text className="mt-2 text-muted-foreground">
        {t(
          "admin.sources.comingSoon",
          "Support for this source is reserved in the data model and ships in a follow-up release.",
        )}
      </Text>
    </Card>
  );
}
