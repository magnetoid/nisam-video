import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Card,
  Metric,
  Text,
  Title,
  Subtitle,
  AreaChart,
  DonutChart,
  Legend,
  Flex,
  Grid,
  Col,
  Badge as TremorBadge,
  ProgressBar,
  Color,
} from "@tremor/react";
import { Button } from "@/components/ui/button";
import {
  TvIcon,
  VideoIcon,
  FolderIcon,
  Activity,
  RefreshCw,
  Play,
  StopCircle,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_CONFIG, PLATFORM_ORDER } from "@/lib/platform-config";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch Analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/analytics?days=30"],
  });

  // Fetch Scheduler Settings/Status
  const { data: scheduler, isLoading: schedulerLoading } = useQuery<any>({
    queryKey: ["/api/scheduler"],
    refetchInterval: 5000, // Poll every 5s for real-time status
  });

  // Fetch Recent Jobs
  const { data: recentJobs = [], isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/scheduler/jobs"],
    refetchInterval: 5000,
  });

  // Fetch per-source breakdown (YouTube / X / TikTok / Instagram).
  const { data: sourcesStats } = useQuery<{
    stats: Array<{ platform: string; channelCount: number; videoCount: number }>;
  }>({
    queryKey: ["/api/admin/sources/stats"],
  });

  // Pre-compute chart data once per data change. Stable color order matches
  // PLATFORM_ORDER so categories line up between donut and progress bars.
  const sourceChartData = useMemo(() => {
    const rows = sourcesStats?.stats ?? [];
    return PLATFORM_ORDER.map((p) => {
      const row = rows.find((r) => r.platform === p);
      return {
        name: PLATFORM_CONFIG[p].label,
        videoCount: row?.videoCount ?? 0,
        channelCount: row?.channelCount ?? 0,
        color: PLATFORM_CONFIG[p].tremorColor,
      };
    });
  }, [sourcesStats]);
  const sourceDonutData = useMemo(
    () => sourceChartData.filter((d) => d.videoCount > 0).map((d) => ({ name: d.name, count: d.videoCount })),
    [sourceChartData],
  );
  const sourceDonutColors = useMemo(
    () => sourceChartData.filter((d) => d.videoCount > 0).map((d) => d.color),
    [sourceChartData],
  );
  const totalChannels = useMemo(
    () => sourceChartData.reduce((sum, r) => sum + r.channelCount, 0),
    [sourceChartData],
  );

  // Scheduler Mutations
  const startSchedulerMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/scheduler/start", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler"] });
      toast({ title: t("admin.schedulerStarted", "Scheduler started") });
    },
  });

  const stopSchedulerMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/scheduler/stop", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler"] });
      toast({ title: t("admin.schedulerStopped", "Scheduler stopped") });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/scheduler/run-now", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/jobs"] });
      toast({ title: t("admin.jobStarted", "Manual scrape job started") });
    },
  });

  const isLoading = analyticsLoading || schedulerLoading || jobsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate daily growth data for chart
  const growthData = analytics?.dailyGrowth?.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    "New Videos": item.count
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title className="text-3xl font-bold dark:text-white">{t("admin.dashboard", "Dashboard")}</Title>
          <Text className="mt-1">
            {t("admin.dashboardDesc", "Platform overview and system health")}
          </Text>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.refresh", "Refresh")}
          </Button>
        </div>
      </div>

      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
        <Card decoration="top" decorationColor="blue">
          <Flex alignItems="start">
            <Text>{t("admin.totalChannels", "Total Channels")}</Text>
            <TvIcon className="h-5 w-5 text-blue-500" />
          </Flex>
          <Metric className="mt-2">{analytics?.totals?.channels || 0}</Metric>
          <Link href="/admin/channels">
            <a className="text-xs text-blue-500 hover:underline mt-4 inline-block">
              {t("admin.viewChannels", "View channels")} &rarr;
            </a>
          </Link>
        </Card>

        <Card decoration="top" decorationColor="fuchsia">
          <Flex alignItems="start">
            <Text>{t("admin.totalVideos", "Total Videos")}</Text>
            <VideoIcon className="h-5 w-5 text-fuchsia-500" />
          </Flex>
          <Metric className="mt-2">{analytics?.totals?.allTimeVideos || 0}</Metric>
          <Link href="/admin/videos">
            <a className="text-xs text-fuchsia-500 hover:underline mt-4 inline-block">
              {t("admin.manageVideos", "Manage videos")} &rarr;
            </a>
          </Link>
        </Card>

        <Card decoration="top" decorationColor="amber">
          <Flex alignItems="start">
            <Text>{t("admin.categories", "Categories")}</Text>
            <FolderIcon className="h-5 w-5 text-amber-500" />
          </Flex>
          <Metric className="mt-2">{analytics?.totals?.categories || 0}</Metric>
          <Link href="/admin/categories">
            <a className="text-xs text-amber-500 hover:underline mt-4 inline-block">
              {t("admin.manageCategories", "Manage categories")} &rarr;
            </a>
          </Link>
        </Card>

        <Card decoration="top" decorationColor={scheduler?.isActive ? "emerald" : "rose"}>
          <Flex alignItems="start">
            <Text>{t("admin.schedulerStatus", "Scheduler Status")}</Text>
            <Activity className={`h-5 w-5 ${scheduler?.isActive ? "text-emerald-500" : "text-rose-500"}`} />
          </Flex>
          <Flex className="mt-2 gap-2 justify-start">
            <Metric>{scheduler?.isActive ? t("common.active", "Active") : t("common.stopped", "Stopped")}</Metric>
            {scheduler?.isRunning && (
              <TremorBadge color="yellow" className="animate-pulse">{t("common.running", "Running")}</TremorBadge>
            )}
          </Flex>
          <Text className="mt-4 text-xs">
            {t("admin.nextRun", "Next run")}: {scheduler?.nextRun ? formatDistanceToNow(new Date(scheduler.nextRun), { addSuffix: true }) : 'N/A'}
          </Text>
        </Card>
      </Grid>

      <Grid numItems={1} numItemsLg={2} className="gap-6 mt-6">
        <Card>
          <Title>{t("admin.videosBySource", "Videos by source")}</Title>
          <Subtitle>
            {t("admin.videosBySourceDesc", "Distribution across YouTube, X, TikTok, and Instagram")}
          </Subtitle>
          {sourceDonutData.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-tremor-content">
              {t("common.noData", "No data available")}
            </div>
          ) : (
            <>
              <DonutChart
                className="h-56 mt-4"
                data={sourceDonutData}
                category="count"
                index="name"
                colors={sourceDonutColors}
                valueFormatter={(n) => Intl.NumberFormat("us").format(n).toString()}
                showAnimation
              />
              <Legend
                className="mt-3"
                categories={sourceDonutData.map((d) => d.name)}
                colors={sourceDonutColors}
              />
            </>
          )}
        </Card>

        <Card>
          <Title>{t("admin.channelsBySource", "Channels by source")}</Title>
          <Subtitle>{t("admin.channelsBySourceDesc", "Number of sources connected per platform")}</Subtitle>
          <div className="mt-4 space-y-3">
            {sourceChartData.map((s) => {
              const pct = totalChannels > 0 ? (s.channelCount / totalChannels) * 100 : 0;
              return (
                <div key={s.name}>
                  <Flex>
                    <Text>{s.name}</Text>
                    <Text>
                      {s.channelCount} ({s.videoCount} videos)
                    </Text>
                  </Flex>
                  <ProgressBar value={pct} color="indigo" className="mt-1" />
                </div>
              );
            })}
            <Link href="/admin/sources">
              <a className="text-xs text-indigo-500 hover:underline mt-3 inline-block">
                {t("admin.manageSources", "Manage sources")} &rarr;
              </a>
            </Link>
          </div>
        </Card>
      </Grid>

      <Grid numItems={1} numItemsLg={3} className="gap-6 mt-6">
        <Col numColSpan={1} numColSpanLg={2}>
          <Card className="h-full">
            <Title>{t("admin.contentGrowth", "Content Growth")}</Title>
            <Subtitle>{t("admin.contentGrowthDesc", "New videos added over the last 30 days")}</Subtitle>
            
            {growthData.length > 0 ? (
              <AreaChart
                className="h-72 mt-4"
                data={growthData}
                index="date"
                categories={["New Videos"]}
                colors={["blue"]}
                valueFormatter={(number) => Intl.NumberFormat("us").format(number).toString()}
                showAnimation={true}
              />
            ) : (
              <div className="flex items-center justify-center h-72 text-tremor-content">
                {t("common.noData", "No data available")}
              </div>
            )}
          </Card>
        </Col>

        <Col numColSpan={1}>
          <Card className="h-full">
            <Title>{t("admin.systemAndJobs", "System & Jobs")}</Title>
            <Subtitle>{t("admin.manageSync", "Manage synchronization")}</Subtitle>
            
            <div className="flex gap-2 mt-6">
              {scheduler?.isActive ? (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => stopSchedulerMutation.mutate()}
                  disabled={stopSchedulerMutation.isPending}
                  className="flex-1"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  {t("admin.stopScheduler", "Stop Scheduler")}
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => startSchedulerMutation.mutate()}
                  disabled={startSchedulerMutation.isPending}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t("admin.startScheduler", "Start Scheduler")}
                </Button>
              )}
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => runNowMutation.mutate()}
                disabled={runNowMutation.isPending || scheduler?.isRunning}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("admin.runNow", "Run Now")}
              </Button>
            </div>

            <div className="mt-8">
              <Text className="font-medium mb-4">{t("admin.recentJobs", "Recent Jobs")}</Text>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {recentJobs.length > 0 ? (
                  recentJobs.map((job: any) => {
                    const statusColor: Color = 
                      job.status === 'completed' ? 'emerald' : 
                      job.status === 'failed' ? 'rose' : 
                      job.status === 'running' ? 'yellow' : 'gray';

                    const progress = job.totalChannels > 0 ? (job.processedChannels / job.totalChannels) * 100 : 0;

                    return (
                      <div key={job.id} className="p-3 rounded-tremor-default border border-tremor-border dark:border-dark-tremor-border">
                        <Flex alignItems="center" justifyContent="between">
                          <Text className="font-medium capitalize">{job.type.replace('_', ' ')}</Text>
                          <TremorBadge color={statusColor} size="sm">
                            {job.status}
                          </TremorBadge>
                        </Flex>
                        <Flex alignItems="center" justifyContent="between" className="mt-2">
                          <Text className="text-xs">{formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}</Text>
                          <Text className="text-xs font-medium">{job.videosAdded} {t("common.videos", "videos")}</Text>
                        </Flex>
                        {job.status === 'running' && (
                          <ProgressBar value={progress} color={statusColor} className="mt-3" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-sm text-tremor-content py-4">
                    {t("admin.noRecentJobs", "No recent jobs")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Col>
      </Grid>
    </div>
  );
}
