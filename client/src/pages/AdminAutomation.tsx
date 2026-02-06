import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, Bar, BarChart, Legend, ResponsiveContainer } from "recharts";
import { CalendarIcon, Search, Filter, Trash2, Play, Pause, BarChart3, Activity } from "lucide-react";
import { toast } from "sonner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SchedulerSettings } from "@shared/schema";

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "all";

type SchedulerStatus = SchedulerSettings & { 
  isActive: boolean; 
  isRunning: boolean;
  timezone: string;
};

type ScrapeJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  transitioning: boolean;
  totalChannels: number;
  processedChannels: number;
  currentChannelName: string | null;
  videosAdded: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  type?: string;
  progress?: number;
  totalItems?: number;
  processedItems?: number;
  failedItems?: number;
  isIncremental?: boolean;
};

type ScrapeJobLogEntry = {
  time: string;
  level: "info" | "warn" | "error" | "debug" | string;
  message: string;
  channelId?: string;
  channelName?: string;
  data?: Record<string, unknown>;
};

function parseErrorCount(errorMessage: string | null): number {
  if (!errorMessage) return 0;
  const m = errorMessage.match(/errors:(\d+)/);
  return m ? Number(m[1]) : 0;
}

function formatDurationSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function AdminAutomation() {
  const [liveJob, setLiveJob] = useState<ScrapeJob | null>(null);
  const [liveLogs, setLiveLogs] = useState<ScrapeJobLogEntry[]>([]);
  const streamRef = useRef<EventSource | null>(null);

  const { data: scheduler } = useQuery<SchedulerStatus>({
    queryKey: ["/api/scheduler"],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const { data: activeJob } = useQuery<ScrapeJob | null>({
    queryKey: ["/api/automation/jobs/active"],
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'retry' | 'delete' | 'pause' | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
    if (dateTo) params.append('dateTo', dateTo.toISOString());
    params.append('limit', itemsPerPage.toString());
    params.append('offset', ((currentPage - 1) * itemsPerPage).toString());
    return params.toString();
  }, [searchTerm, statusFilter, dateFrom, dateTo, currentPage]);

  const { data: jobsData, isLoading: jobsLoading } = useQuery<ScrapeJob[]>({
    queryKey: ["/api/automation/jobs", queryParams],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const jobs = useMemo(() => jobsData || [], [jobsData]);
  const totalJobs = jobs.length; // For pagination, ideally from backend count

  const runNowMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scheduler/run-now");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automation/jobs/active"] });
    },
  });

  useEffect(() => {
    const jobId = activeJob?.id;
    if (!jobId) {
      setLiveJob(null);
      setLiveLogs([]);
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
      // Fallback to polling if no job
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000;

    const createStream = () => {
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }

      const source = new EventSource(`/api/automation/jobs/${jobId}/stream`);
      streamRef.current = source;

      const onSnapshot = (ev: MessageEvent) => {
        try {
          const snapshot = JSON.parse(ev.data);
          setLiveJob(snapshot);
        } catch (e) {
          console.error('SSE snapshot parse error:', e);
        }
      };

      const onLogsInit = (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data);
          setLiveLogs(Array.isArray(payload.entries) ? payload.entries : []);
        } catch (e) {
          console.error('SSE logs_init parse error:', e);
        }
      };

      const onLog = (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data);
          const entries: ScrapeJobLogEntry[] = Array.isArray(payload.entries) ? payload.entries : [];
          if (entries.length === 0) return;
          setLiveLogs((prev) => [...prev, ...entries].slice(-500));
        } catch (e) {
          console.error('SSE log parse error:', e);
        }
      };

      const onJobComplete = (ev: MessageEvent) => {
        try {
          const { status } = JSON.parse(ev.data);
          toast.success(`Job completed with status: ${status}`);
          queryClient.invalidateQueries({ queryKey: ['/api/automation/jobs'] });
          queryClient.invalidateQueries({ queryKey: ['/api/automation/jobs/active'] });
          setLiveJob(null);
          setLiveLogs([]);
        } catch (e) {
          console.error('SSE job_complete parse error:', e);
        }
      };

      const onError = (ev: MessageEvent) => {
        console.error('SSE error:', ev);
        source.close();
        streamRef.current = null;
        toast.error('Connection lost. Reconnecting...');

        if (retryCount < maxRetries) {
          retryCount++;
          const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
          setTimeout(createStream, delay);
        } else {
          toast.error('Failed to reconnect. Falling back to polling.');
          // Trigger query refetch as fallback
          queryClient.invalidateQueries({ queryKey: ['/api/automation/jobs/active'] });
        }
      };

      source.addEventListener("snapshot", onSnapshot);
      source.addEventListener("logs_init", onLogsInit);
      source.addEventListener("log", onLog);
      source.addEventListener("job_complete", onJobComplete);
      source.addEventListener("error", onError);
      source.addEventListener("ping", () => {}); // Ack pings

      return source;
    };

    createStream();

    return () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/jobs/active'] });
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
    };
  }, [activeJob?.id]);

  const displayedJob = liveJob ?? activeJob;
  const running = displayedJob && displayedJob.status === "running";

  const progressPct = useMemo(() => {
    if (!displayedJob) return 0;
    if (typeof displayedJob.progress === "number") return Math.min(100, Math.max(0, displayedJob.progress));
    if (displayedJob.totalChannels > 0) {
      return Math.min(100, Math.round((displayedJob.processedChannels / displayedJob.totalChannels) * 100));
    }
    return 0;
  }, [displayedJob]);

  const failedItems = displayedJob?.failedItems ?? parseErrorCount(displayedJob?.errorMessage ?? null);
  const processedItems = displayedJob?.processedItems ?? displayedJob?.processedChannels ?? 0;
  const totalItems = displayedJob?.totalItems ?? displayedJob?.totalChannels ?? 0;
  const succeededItems = Math.max(0, processedItems - failedItems);

  const etaSeconds = (() => {
    if (!displayedJob) return 0;
    if (displayedJob.status !== "running") return 0;
    if (processedItems <= 0) return 0;
    const started = new Date(displayedJob.startedAt).getTime();
    const now = Date.now();
    const elapsed = (now - started) / 1000;
    const perItem = elapsed / processedItems;
    const remaining = Math.max(0, totalItems - processedItems);
    return remaining * perItem;
  })();

  const speed = useMemo(() => {
    if (!displayedJob) return { channelsPerMin: 0, videosPerMin: 0 };
    const started = new Date(displayedJob.startedAt).getTime();
    const elapsedMinutes = Math.max(0.01, (Date.now() - started) / 60000);
    const channelsPerMin = processedItems / elapsedMinutes;
    const videosPerMin = (displayedJob.videosAdded || 0) / elapsedMinutes;
    return { channelsPerMin, videosPerMin };
  }, [displayedJob, processedItems]);

  const [activeTab, setActiveTab] = useState<'monitor' | 'analytics'>('monitor');
  const { data: analyticsData } = useQuery({
    queryKey: ['/api/automation/analytics', { period: 30 }],
    refetchInterval: 30000, // 30s for analytics
  });

  const chartConfig: ChartConfig = {
    videosAdded: {
      label: "Videos Added",
      color: "hsl(var(--primary))",
    },
    errors: {
      label: "Errors",
      color: "hsl(var(--destructive))",
    },
    completed: {
      label: "Completed Jobs",
      color: "hsl(var(--chart-green-500))",
    },
    failed: {
      label: "Failed Jobs",
      color: "hsl(var(--chart-red-500))",
    },
  } satisfies ChartConfig;

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-8 ml-[240px] lg:ml-[240px] md:ml-0 sm:p-4" aria-label="Main content">
        <div className="max-w-6xl mx-auto space-y-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'monitor' | 'analytics')} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monitor" className="space-x-2">
                <Activity className="h-4 w-4" />
                <span>Monitor</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monitor" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Automation</h1>
                  <p className="text-muted-foreground mt-1">Monitor incremental scraping progress and history.</p>
                </div>
                <Button onClick={() => runNowMutation.mutate()} disabled={runNowMutation.isPending}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${runNowMutation.isPending ? "animate-spin" : ""}`} />
                  Run Incremental Batch
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Scheduler</CardTitle>
                    <CardDescription>Interval and current state</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Enabled</span>
                      <Badge variant="secondary">{scheduler?.isActive ? "yes" : "no"}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Running</span>
                      <Badge variant={scheduler?.isRunning ? "default" : "secondary"}>
                        {scheduler?.isRunning ? "yes" : "no"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Interval</span>
                      <span>{scheduler?.intervalHours ?? 6}h</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Next run</span>
                      <span>{scheduler?.nextRun ? new Date(scheduler.nextRun).toLocaleString() : "-"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Current Batch</CardTitle>
                    <CardDescription>Live incremental job progress</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {displayedJob ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant={running ? "default" : "secondary"}>{displayedJob.status}</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {processedItems} / {totalItems} items
                            </span>
                            <span className="font-medium">{progressPct}%</span>
                          </div>
                          <Progress value={progressPct} className="h-2" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Current channel</span>
                          <span className="truncate max-w-[260px]">{displayedJob.currentChannelName || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Videos added</span>
                          <span>{displayedJob.videosAdded}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Succeeded / Failed</span>
                          <span>
                            {succeededItems} / {failedItems}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Speed</span>
                          <span>
                            {speed.channelsPerMin.toFixed(2)} items/min · {speed.videosPerMin.toFixed(2)} videos/min
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            ETA
                          </span>
                          <span>{formatDurationSeconds(etaSeconds)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">No active scrape job.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Live Logs</CardTitle>
                  <CardDescription>Most recent scraping activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border h-[320px] overflow-auto p-3 text-sm">
                    {liveLogs.length === 0 ? (
                      <div className="text-muted-foreground">No logs yet.</div>
                    ) : (
                      <div className="space-y-1">
                        {liveLogs.map((l, idx) => (
                          <div key={`${l.time}-${idx}`} className="flex gap-3">
                            <span className="text-muted-foreground shrink-0">
                              {new Date(l.time).toLocaleTimeString()}
                            </span>
                            <span className="shrink-0">
                              <Badge variant={l.level === "error" ? "destructive" : "secondary"}>{l.level}</Badge>
                            </span>
                            <span className="truncate">
                              {l.channelName ? `[${l.channelName}] ` : ""}
                              {l.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('automation.recentJobs', 'Recent Jobs')}</CardTitle>
                  <CardDescription>{t('automation.jobsDesc', `${itemsPerPage} scheduler runs per page`)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="flex-1 space-y-2">
                      <label htmlFor="search" className="text-sm font-medium text-muted-foreground">
                        {t('automation.search', 'Search jobs')}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder={t('automation.searchPlaceholder', 'Search by type or channel...')}
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="status" className="text-sm font-medium text-muted-foreground">
                        {t('automation.statusFilter', 'Status')}
                      </label>
                      <Select value={statusFilter} onValueChange={(value) => {
                        setStatusFilter(value as JobStatus);
                        setCurrentPage(1);
                      }}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder={t('automation.allStatuses', 'All statuses')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
                          <SelectItem value="pending">{t('automation.pending', 'Pending')}</SelectItem>
                          <SelectItem value="running">{t('automation.running', 'Running')}</SelectItem>
                          <SelectItem value="completed">{t('automation.completed', 'Completed')}</SelectItem>
                          <SelectItem value="failed">{t('automation.failed', 'Failed')}</SelectItem>
                          <SelectItem value="cancelled">{t('automation.cancelled', 'Cancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        {t('automation.dateRange', 'Date Range')}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[240px] justify-start text-left font-normal" id="date">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateFrom ? (
                              dateTo ? (
                                <>{format(dateFrom, 'PPP')} - {format(dateTo, 'PPP')}</>
                              ) : (
                                format(dateFrom, 'PPP')
                              )
                            ) : (
                              <span>{t('automation.pickDate', 'Pick a date')}</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={{ from: dateFrom, to: dateTo }}
                            defaultMonth={dateFrom}
                            onSelect={({ from, to }) => {
                              setDateFrom(from);
                              setDateTo(to);
                              setCurrentPage(1);
                            }}
                            numberOfMonths={2}
                            className="p-3"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Bulk Actions - only show if jobs selected */}
                    {selectedJobs.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setBulkAction('retry');
                            setShowBulkDialog(true);
                          }}
                          disabled={selectedJobs.every(id => !jobs.find(j => j.id === id)?.status === 'failed')}
                          aria-label="Retry selected jobs"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Retry ({selectedJobs.length})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setBulkAction('delete');
                            setShowBulkDialog(true);
                          }}
                          aria-label="Delete selected jobs"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete ({selectedJobs.length})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setBulkAction('pause');
                            setShowBulkDialog(true);
                          }}
                          disabled={selectedJobs.every(id => !jobs.find(j => j.id === id)?.status === 'running')}
                          aria-label="Pause selected jobs"
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pause ({selectedJobs.length})
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setDateFrom(undefined);
                        setDateTo(undefined);
                        setCurrentPage(1);
                      }}
                      aria-label={t('automation.clearFilters', 'Clear filters')}
                    >
                      {t('common.clear', 'Clear')}
                    </Button>
                  </div>

                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead aria-label={t('automation.statusHeader', 'Status')}>Status</TableHead>
                          <TableHead aria-label={t('automation.progressHeader', 'Progress')}>Progress</TableHead>
                          <TableHead aria-label={t('automation.videosHeader', 'Videos')}>Videos</TableHead>
                          <TableHead aria-label={t('automation.errorsHeader', 'Errors')}>Errors</TableHead>
                          <TableHead aria-label={t('automation.startedHeader', 'Started')}>Started</TableHead>
                          <TableHead aria-label={t('automation.completedHeader', 'Completed')}>Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobsLoading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground" role="status" aria-live="polite">
                              {t('common.loading', 'Loading…')}
                            </TableCell>
                          </TableRow>
                        ) : jobs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground" role="status" aria-live="polite">
                              {t('automation.noJobs', 'No jobs yet.')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          jobs.map((job) => {
                            const pct =
                              job.totalChannels > 0
                                ? Math.min(100, Math.round((job.processedChannels / job.totalChannels) * 100))
                                : 0;
                            const errs = parseErrorCount(job.errorMessage);
                            return (
                              <TableRow key={job.id}>
                                <TableCell className="w-4">
                                  <Checkbox
                                    checked={selectedJobs.includes(job.id)}
                                    onCheckedChange={(checked) => {
                                      setSelectedJobs(checked 
                                        ? [...selectedJobs, job.id] 
                                        : selectedJobs.filter(id => id !== job.id)
                                      );
                                    }}
                                    aria-label={`Select job ${job.id}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={job.status === "failed" ? "destructive" : job.status === "running" ? "default" : "secondary"} 
                                    aria-label={`Job status: ${job.status}`}
                                  >
                                    {job.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="w-[220px]">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span aria-label={`${pct}% complete`}>{pct}%</span>
                                      <span aria-label={`${job.processedChannels} of ${job.totalChannels} processed`}>
                                        {job.processedChannels}/{job.totalChannels}
                                      </span>
                                    </div>
                                    <Progress value={pct} className="h-2" aria-label={`${pct}% progress for job ${job.id}`} />
                                  </div>
                                </TableCell>
                                <TableCell aria-label={`${job.videosAdded} videos added`}>{job.videosAdded}</TableCell>
                                <TableCell aria-label={`${errs} errors`}>{errs}</TableCell>
                                <TableCell className="text-xs text-muted-foreground" aria-label={`Started: ${new Date(job.startedAt).toLocaleString()}`}>
                                  {new Date(job.startedAt).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground" aria-label={`Completed: ${job.completedAt ? new Date(job.completedAt).toLocaleString() : 'Not completed'}`}>
                                  {job.completedAt ? new Date(job.completedAt).toLocaleString() : t('common.notCompleted', '-')}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {!jobsLoading && totalJobs > itemsPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-b-lg">
                      <div className="text-sm text-muted-foreground">
                        {t('common.showing', 'Showing')} {((currentPage - 1) * itemsPerPage) + 1} {t('common.to', 'to')} {Math.min(currentPage * itemsPerPage, totalJobs)} {t('common.of', 'of')} {totalJobs} {t('automation.jobs', 'jobs')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          aria-label={t('common.previousPage', 'Previous page')}
                        >
                          {t('common.previous', 'Previous')}
                        </Button>
                        <span className="text-sm font-medium">
                          {t('common.page', 'Page')} {currentPage}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => p + 1)}
                          disabled={jobs.length < itemsPerPage}
                          aria-label={t('common.nextPage', 'Next page')}
                        >
                          {t('common.next', 'Next')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Scraping Analytics (30 days)</CardTitle>
                  <CardDescription>Trends in job performance and outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 h-[400px]">
                    <div className="space-y-4">
                      <h3 className="font-semibold">Videos Added Over Time</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analyticsData?.data || []}>
                          <XAxis dataKey="date" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="totalVideosAdded" stroke={chartConfig.videosAdded.color as string} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold">Job Status Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analyticsData?.data || []}>
                          <XAxis dataKey="date" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Bar dataKey="completedJobs" fill={chartConfig.completed.color as string} name="Completed" />
                          <Bar dataKey="failedJobs" fill={chartConfig.failed.color as string} name="Failed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
