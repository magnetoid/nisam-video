import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Code, Download, FileText, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SitemapAndRobotsPanel({
  defaultLanguage,
  onSavedRobots,
}: {
  defaultLanguage: string;
  onSavedRobots: () => void;
}) {
  const { toast } = useToast();
  const [includeVideos, setIncludeVideos] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [includeChannels, setIncludeChannels] = useState(true);
  const [maxVideos, setMaxVideos] = useState(5000);

  const sitemapUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("lang", defaultLanguage || "en");
    params.set("includeVideos", includeVideos ? "1" : "0");
    params.set("includeCategories", includeCategories ? "1" : "0");
    params.set("includeTags", includeTags ? "1" : "0");
    params.set("includeChannels", includeChannels ? "1" : "0");
    params.set("maxVideos", String(Math.max(0, Math.floor(maxVideos || 0))));
    return `/api/seo/enhanced/sitemap?${params.toString()}`;
  }, [defaultLanguage, includeVideos, includeCategories, includeTags, includeChannels, maxVideos]);

  const {
    data: sitemap,
    isFetching: sitemapFetching,
    refetch: refetchSitemap,
  } = useQuery<{ xml: string; status: number; urlCount: number; bytes: number; fetchedAt: string }>({
    queryKey: ["admin-sitemap", sitemapUrl],
    queryFn: async () => {
      const res = await fetch(sitemapUrl, { cache: "no-store" });
      const text = await res.text();
      const urlCount = (text.match(/<url>/g) || []).length;
      return {
        xml: text,
        status: res.status,
        urlCount,
        bytes: new Blob([text]).size,
        fetchedAt: new Date().toISOString(),
      };
    },
  });

  const { data: robotsText, isFetching: robotsFetching } = useQuery<string>({
    queryKey: ["admin-robots"],
    queryFn: async () => {
      const res = await fetch("/api/seo/enhanced/robots-txt", { cache: "no-store" });
      return await res.text();
    },
  });

  const [robotsDraft, setRobotsDraft] = useState("");
  useEffect(() => {
    if (robotsText && !robotsDraft) setRobotsDraft(robotsText);
  }, [robotsText, robotsDraft]);

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/seo/enhanced/sitemap/regenerate");
    },
    onSuccess: () => {
      refetchSitemap();
      toast({
        title: "Sitemap Regenerated",
        description: "The sitemap cache has been cleared and rebuilt.",
      });
    },
    onError: (error) => {
      toast({
        title: "Regeneration failed",
        description: "Failed to clear sitemap cache.",
        variant: "destructive",
      });
    }
  });

  const saveRobotsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/seo/enhanced/robots-txt", { content: robotsDraft });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-robots"] });
      onSavedRobots();
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to update robots.txt",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sitemap
          </CardTitle>
          <CardDescription>Preview and manually regenerate/download your sitemap.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
              <span className="text-sm">Videos</span>
              <input type="checkbox" checked={includeVideos} onChange={(e) => setIncludeVideos(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
              <span className="text-sm">Categories</span>
              <input type="checkbox" checked={includeCategories} onChange={(e) => setIncludeCategories(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
              <span className="text-sm">Tags</span>
              <input type="checkbox" checked={includeTags} onChange={(e) => setIncludeTags(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
              <span className="text-sm">Channels</span>
              <input type="checkbox" checked={includeChannels} onChange={(e) => setIncludeChannels(e.target.checked)} />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium mb-1">Max videos</div>
              <Input
                type="number"
                value={maxVideos}
                onChange={(e) => setMaxVideos(Number(e.target.value))}
                min={0}
              />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Language</div>
              <Input value={defaultLanguage || "en"} readOnly />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => regenerateMutation.mutate()} disabled={sitemapFetching || regenerateMutation.isPending}>
              <RefreshCw className={`h-4 w-4 ${sitemapFetching || regenerateMutation.isPending ? "animate-spin" : ""}`} />
              {sitemapFetching || regenerateMutation.isPending ? "Regenerating..." : "Regenerate"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!sitemap?.xml) return;
                const blob = new Blob([sitemap.xml], { type: "application/xml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `sitemap-${new Date().toISOString().slice(0, 10)}.xml`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              disabled={!sitemap?.xml}
            >
              <Download className="h-4 w-4" />
              Download XML
            </Button>
            <a href={sitemapUrl} target="_blank" rel="noreferrer" className="inline-flex">
              <Button type="button" variant="outline" className="gap-2">
                <Code className="h-4 w-4" />
                Open Preview
              </Button>
            </a>
          </div>

          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <span className="font-mono">{sitemap?.status ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-muted-foreground">URLs</span>
              <span className="font-mono">{sitemap?.urlCount ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-muted-foreground">Size</span>
              <span className="font-mono">{typeof sitemap?.bytes === "number" ? `${Math.round(sitemap.bytes / 1024)} KB` : "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-muted-foreground">Fetched</span>
              <span className="font-mono">{sitemap?.fetchedAt ? new Date(sitemap.fetchedAt).toLocaleString() : "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Robots.txt
          </CardTitle>
          <CardDescription>Edit crawler rules and ensure the sitemap URL is present.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={robotsFetching ? "Loading…" : robotsDraft}
            onChange={(e) => setRobotsDraft(e.target.value)}
            className="min-h-[320px] font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => saveRobotsMutation.mutate()} disabled={saveRobotsMutation.isPending}>
              {saveRobotsMutation.isPending ? "Saving…" : "Save robots.txt"}
            </Button>
            <a href="/robots.txt" target="_blank" rel="noreferrer" className="inline-flex">
              <Button type="button" variant="outline" className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                View public
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
