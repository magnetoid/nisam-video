import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Database,
  Trash2,
  BarChart3,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CacheSettings {
  cacheEnabled: boolean;
  cacheVideosTTL: number;
  cacheChannelsTTL: number;
  cacheCategoriesTTL: number;
  cacheApiTTL: number;
}

interface CacheStats {
  totalKeys: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

interface PerfRouteStat {
  route: string;
  count: number;
  errorCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  lastSeen: string;
}

interface PerformanceSummary {
  routeCount: number;
  slowestByP95: PerfRouteStat[];
  slowestByAvg: PerfRouteStat[];
}

export default function AdminCacheSettings() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CacheSettings>({
    cacheEnabled: true,
    cacheVideosTTL: 300,
    cacheChannelsTTL: 600,
    cacheCategoriesTTL: 600,
    cacheApiTTL: 180,
  });

  const { data: settings, isLoading: settingsLoading } =
    useQuery<CacheSettings>({
      queryKey: ["/api/admin/cache/settings"],
    });

  const { data: stats, refetch: refetchStats } = useQuery<CacheStats>({
    queryKey: ["/api/admin/cache/stats"],
    refetchInterval: 5000,
  });

  const { data: perfSummary } = useQuery<PerformanceSummary>({
    queryKey: ["/api/admin/performance/summary"],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<CacheSettings>) => {
      return await apiRequest("PUT", "/api/admin/cache/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/cache/settings"],
      });
      toast({
        title: "Settings Updated",
        description: "Cache settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update cache settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/cache/clear");
    },
    onSuccess: () => {
      refetchStats();
      toast({
        title: "Cache Cleared",
        description: "All cached data has been cleared successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Clear Failed",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(formData);
  };

  const handleClearCache = () => {
    if (
      confirm(
        "Are you sure you want to clear all cached data? This cannot be undone.",
      )
    ) {
      clearCacheMutation.mutate();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AdminSidebar />
        <main className="ml-60 pt-16 p-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />
      <main className="ml-60 pt-16 p-8 space-y-6">
        <div>
          <h1
            className="text-3xl font-bold text-foreground"
            data-testid="text-page-title"
          >
            Cache Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure and monitor application caching for improved performance
          </p>
        </div>

        {/* Cache Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Cache Statistics
            </CardTitle>
            <CardDescription>
              Real-time cache performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Keys</p>
                  <p
                    className="text-2xl font-bold"
                    data-testid="text-total-keys"
                  >
                    {stats.totalKeys}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Hit Rate</p>
                  <div className="flex items-center gap-2">
                    <p
                      className="text-2xl font-bold"
                      data-testid="text-hit-rate"
                    >
                      {stats.hitRate.toFixed(1)}%
                    </p>
                    {stats.hitRate >= 70 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Hits</p>
                  <p
                    className="text-2xl font-bold text-green-600"
                    data-testid="text-total-hits"
                  >
                    {stats.totalHits.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Misses</p>
                  <p
                    className="text-2xl font-bold text-red-600"
                    data-testid="text-total-misses"
                  >
                    {stats.totalMisses.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Memory Usage</p>
                  <p className="text-lg font-semibold">
                    {formatBytes(stats.memoryUsage)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Oldest Entry</p>
                  <p className="text-lg font-semibold">
                    {formatTimeAgo(stats.oldestEntry)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Newest Entry</p>
                  <p className="text-lg font-semibold">
                    {formatTimeAgo(stats.newestEntry)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant={formData.cacheEnabled ? "default" : "secondary"}
                  >
                    {formData.cacheEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Loading statistics...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              API Performance
            </CardTitle>
            <CardDescription>Rolling p50/p95 timings by route</CardDescription>
          </CardHeader>
          <CardContent>
            {!perfSummary ? (
              <p className="text-muted-foreground">Loading performance metrics...</p>
            ) : perfSummary.slowestByP95.length === 0 ? (
              <p className="text-muted-foreground">No routes recorded yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">p50</TableHead>
                      <TableHead className="text-right">p95</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                      <TableHead className="text-right">5xx</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perfSummary.slowestByP95.map((r) => (
                      <TableRow key={r.route}>
                        <TableCell className="font-mono text-xs">{r.route}</TableCell>
                        <TableCell className="text-right">{r.count}</TableCell>
                        <TableCell className="text-right">{r.p50Ms}ms</TableCell>
                        <TableCell className="text-right">{r.p95Ms}ms</TableCell>
                        <TableCell className="text-right">{r.maxMs}ms</TableCell>
                        <TableCell className="text-right">{r.errorCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cache Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Configuration
            </CardTitle>
            <CardDescription>
              Configure Time-To-Live (TTL) values in seconds for different cache
              layers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cache-enabled">Enable Caching</Label>
                <p className="text-sm text-muted-foreground">
                  Turn caching on or off globally
                </p>
              </div>
              <Switch
                id="cache-enabled"
                checked={formData.cacheEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, cacheEnabled: checked })
                }
                data-testid="switch-cache-enabled"
              />
            </div>

            <Separator />

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="videos-ttl">Videos Cache TTL (seconds)</Label>
                <Input
                  id="videos-ttl"
                  type="number"
                  min="0"
                  value={formData.cacheVideosTTL}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cacheVideosTTL: parseInt(e.target.value) || 0,
                    })
                  }
                  data-testid="input-videos-ttl"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {Math.floor(formData.cacheVideosTTL / 60)} minutes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="channels-ttl">
                  Channels Cache TTL (seconds)
                </Label>
                <Input
                  id="channels-ttl"
                  type="number"
                  min="0"
                  value={formData.cacheChannelsTTL}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cacheChannelsTTL: parseInt(e.target.value) || 0,
                    })
                  }
                  data-testid="input-channels-ttl"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {Math.floor(formData.cacheChannelsTTL / 60)} minutes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categories-ttl">
                  Categories Cache TTL (seconds)
                </Label>
                <Input
                  id="categories-ttl"
                  type="number"
                  min="0"
                  value={formData.cacheCategoriesTTL}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cacheCategoriesTTL: parseInt(e.target.value) || 0,
                    })
                  }
                  data-testid="input-categories-ttl"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {Math.floor(formData.cacheCategoriesTTL / 60)}{" "}
                  minutes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-ttl">
                  API Response Cache TTL (seconds)
                </Label>
                <Input
                  id="api-ttl"
                  type="number"
                  min="0"
                  value={formData.cacheApiTTL}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cacheApiTTL: parseInt(e.target.value) || 0,
                    })
                  }
                  data-testid="input-api-ttl"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {Math.floor(formData.cacheApiTTL / 60)} minutes
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateSettingsMutation.isPending && (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                )}
                Save Settings
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearCache}
                disabled={clearCacheMutation.isPending}
                data-testid="button-clear-cache"
              >
                {clearCacheMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cache Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Optimal TTL Values</p>
                <p className="text-sm text-muted-foreground">
                  Videos: 5 minutes, Channels: 10 minutes, Categories: 10
                  minutes, API: 3 minutes
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Monitor Hit Rate</p>
                <p className="text-sm text-muted-foreground">
                  A hit rate above 70% indicates good caching performance
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Clear Cache After Updates</p>
                <p className="text-sm text-muted-foreground">
                  Clear cache after bulk operations or data imports to ensure
                  fresh data
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
