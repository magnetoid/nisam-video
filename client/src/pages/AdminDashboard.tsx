import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TvIcon,
  VideoIcon,
  FolderIcon,
  TrendingUp,
  Clock,
  Calendar,
  Activity,
  RefreshCw,
  Play,
  StopCircle,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch Analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics?days=30"],
  });

  // Fetch Scheduler Settings/Status
  const { data: scheduler, isLoading: schedulerLoading } = useQuery({
    queryKey: ["/api/scheduler"],
    refetchInterval: 5000, // Poll every 5s for real-time status
  });

  // Fetch Recent Jobs
  const { data: recentJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/scheduler/jobs"],
    refetchInterval: 5000,
  });

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
  const growthData = analytics?.dailyGrowth || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.dashboard", "Dashboard")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.dashboardDesc", "Platform overview and system health")}
          </p>
        </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("common.refresh", "Refresh")}
              </Button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("admin.totalChannels", "Total Channels")}
                </CardTitle>
                <TvIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.totals?.channels || 0}
                </div>
                <Link href="/admin/channels">
                  <a className="text-xs text-primary hover:underline">
                    {t("admin.viewChannels", "View channels")} →
                  </a>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("admin.totalVideos", "Total Videos")}
                </CardTitle>
                <VideoIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.totals?.allTimeVideos || 0}
                </div>
                <Link href="/admin/videos">
                  <a className="text-xs text-primary hover:underline">
                    {t("admin.manageVideos", "Manage videos")} →
                  </a>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("admin.categories", "Categories")}</CardTitle>
                <FolderIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics?.totals?.categories || 0}
                </div>
                <Link href="/admin/categories">
                  <a className="text-xs text-primary hover:underline">
                    {t("admin.manageCategories", "Manage categories")} →
                  </a>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("admin.schedulerStatus", "Scheduler Status")}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${scheduler?.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">
                    {scheduler?.isActive ? t("common.active", "Active") : t("common.stopped", "Stopped")}
                  </span>
                  {scheduler?.isRunning && (
                    <Badge variant="secondary" className="ml-auto animate-pulse">{t("common.running", "Running")}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("admin.nextRun", "Next run")}: {scheduler?.nextRun ? formatDistanceToNow(new Date(scheduler.nextRun), { addSuffix: true }) : 'N/A'}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            {/* Charts Section */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>{t("admin.contentGrowth", "Content Growth")}</CardTitle>
                <CardDescription>
                  {t("admin.contentGrowthDesc", "New videos added over the last 30 days")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px]">
                  {growthData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={growthData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          minTickGap={30}
                          fontSize={12}
                        />
                        <YAxis fontSize={12} />
                        <Tooltip 
                          labelFormatter={(date) => new Date(date).toLocaleDateString()}
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {t("common.noData", "No data available")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scheduler Control & Recent Jobs */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>{t("admin.systemAndJobs", "System & Jobs")}</CardTitle>
                <CardDescription>{t("admin.manageSync", "Manage synchronization")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
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

                  <div className="space-y-2 mt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("admin.recentJobs", "Recent Jobs")}</h4>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                      {recentJobs.length > 0 ? (
                        recentJobs.map((job: any) => (
                          <div key={job.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/40">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm capitalize">{job.type.replace('_', ' ')}</span>
                                <Badge variant={
                                  job.status === 'completed' ? 'default' : 
                                  job.status === 'failed' ? 'destructive' : 
                                  job.status === 'running' ? 'secondary' : 'outline'
                                } className="text-[10px] px-1.5 py-0">
                                  {job.status}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-medium">{job.videosAdded} {t("common.videos", "videos")}</div>
                              <div className="text-muted-foreground">{job.processedChannels} / {job.totalChannels} ch</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-sm text-muted-foreground py-4">
                          {t("admin.noRecentJobs", "No recent jobs")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
             {/* Top Channels */}
             <Card>
              <CardHeader>
                <CardTitle>{t("admin.topChannels", "Top Channels")}</CardTitle>
                <CardDescription>{t("admin.byVideoCount", "By video count")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                   {analytics?.channelPerformance?.slice(0, 5).map((channel: any, i: number) => (
                     <div key={i} className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                           {i + 1}
                         </div>
                         <span className="text-sm font-medium">{channel.name}</span>
                       </div>
                       <span className="text-sm text-muted-foreground">{channel.videoCount} {t("common.videos", "videos")}</span>
                     </div>
                   ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Categories */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.categoryDistribution", "Category Distribution")}</CardTitle>
                <CardDescription>{t("admin.videosPerCategory", "Videos per category")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.topCategories || []} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{ fontSize: 12 }} 
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
  );
}
