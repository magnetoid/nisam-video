import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square, RefreshCw, Clock, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SchedulerSettings } from "@shared/schema";

interface SchedulerStatus extends SchedulerSettings {
  isActive: boolean;
  isRunning: boolean;
  hasTask?: boolean;
  runtimeMode?: "serverless" | "process";
}

import { useTranslation } from "react-i18next";

export default function AdminScheduler() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedInterval, setSelectedInterval] = useState(6);

  const { data: scheduler, isLoading } = useQuery<SchedulerStatus>({
    queryKey: ["/api/scheduler"],
  });

  useEffect(() => {
    if (scheduler?.intervalHours) {
      setSelectedInterval(scheduler.intervalHours);
    }
  }, [scheduler?.intervalHours]);

  const startMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scheduler/start");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler"] });
      toast({
        title: t("admin.scheduler.started_title"),
        description: t("admin.scheduler.started_desc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("admin.scheduler.start_error"),
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scheduler/stop");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler"] });
      toast({
        title: t("admin.scheduler.stopped_title"),
        description: t("admin.scheduler.stopped_desc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("admin.scheduler.stop_error"),
        variant: "destructive",
      });
    },
  });

  const updateIntervalMutation = useMutation({
    mutationFn: async (intervalHours: number) => {
      await apiRequest("PATCH", "/api/scheduler", { intervalHours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler"] });
      toast({
        title: t("admin.scheduler.interval_updated_title"),
        description: t("admin.scheduler.interval_updated_desc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("admin.scheduler.update_interval_error"),
        variant: "destructive",
      });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/scheduler/run-now");
    },
    onSuccess: () => {
      toast({
        title: t("admin.scheduler.job_completed_title"),
        description: t("admin.scheduler.job_completed_desc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("admin.scheduler.job_start_error"),
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return t("common.never");
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleString();
  };

  const getStatusBadge = () => {
    if (scheduler?.isRunning) {
      return (
        <Badge variant="default" className="bg-green-600">
          {t("admin.scheduler.status_running")}
        </Badge>
      );
    }
    if (scheduler?.isEnabled) {
      return (
        <Badge variant="default" className="bg-blue-600">
          {t("admin.scheduler.status_enabled")}
        </Badge>
      );
    }
    return <Badge variant="secondary">{t("admin.scheduler.status_stopped")}</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          {t("admin.scheduler.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("admin.scheduler.subtitle")}
        </p>
      </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {t("admin.scheduler.loading")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t("admin.scheduler.status_title")}</CardTitle>
                      <CardDescription>
                        {t("admin.scheduler.status_desc")}
                      </CardDescription>
                    </div>
                    {getStatusBadge()}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {scheduler?.isEnabled && scheduler?.runtimeMode === "serverless" && scheduler?.hasTask === false && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                      {t("admin.scheduler.serverless_warning", { endpoint: "/api/scheduler/run-now" })}
                    </div>
                  )}

                  {scheduler?.isEnabled && !scheduler?.isRunning && (
                    <div className="text-sm text-muted-foreground">
                      {t("admin.scheduler.running_job_note")}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{t("admin.scheduler.last_run")}</span>
                      </div>
                      <p
                        className="text-lg font-medium"
                        data-testid="text-last-run"
                      >
                        {formatDate(scheduler?.lastRun)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{t("admin.scheduler.next_run")}</span>
                      </div>
                      <p
                        className="text-lg font-medium"
                        data-testid="text-next-run"
                      >
                        {formatDate(scheduler?.nextRun)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t("admin.scheduler.scrape_interval")}
                    </p>
                    <p className="text-lg font-medium">
                      {t("admin.scheduler.every_hours", { count: scheduler?.intervalHours })}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.scheduler.controls_title")}</CardTitle>
                  <CardDescription>
                    {t("admin.scheduler.controls_desc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    {scheduler?.isEnabled ? (
                      <Button
                        onClick={() => stopMutation.mutate()}
                        disabled={stopMutation.isPending}
                        variant="destructive"
                        className="gap-2"
                        data-testid="button-stop-scheduler"
                      >
                        <Square className="h-4 w-4" />
                        {t("admin.scheduler.stop")}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => startMutation.mutate()}
                        disabled={startMutation.isPending}
                        className="gap-2"
                        data-testid="button-start-scheduler"
                      >
                        <Play className="h-4 w-4" />
                        {t("admin.scheduler.start")}
                      </Button>
                    )}

                    <Button
                      onClick={() => runNowMutation.mutate()}
                      disabled={
                        runNowMutation.isPending || scheduler?.isRunning
                      }
                      variant="outline"
                      className="gap-2"
                      data-testid="button-run-now"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${scheduler?.isRunning ? "animate-spin" : ""}`}
                      />
                      {scheduler?.isRunning ? t("admin.scheduler.scraping") : t("admin.scheduler.run_now")}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("admin.scheduler.scrape_interval")}
                    </label>
                    <div className="flex gap-3">
                      <Select
                        value={selectedInterval.toString()}
                        onValueChange={(value) =>
                          setSelectedInterval(parseInt(value))
                        }
                      >
                        <SelectTrigger
                          className="w-[200px]"
                          data-testid="select-interval"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">{t("admin.scheduler.every_1_hour")}</SelectItem>
                          <SelectItem value="6">{t("admin.scheduler.every_6_hours")}</SelectItem>
                          <SelectItem value="12">{t("admin.scheduler.every_12_hours")}</SelectItem>
                          <SelectItem value="24">{t("admin.scheduler.every_24_hours")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() =>
                          updateIntervalMutation.mutate(selectedInterval)
                        }
                        disabled={
                          updateIntervalMutation.isPending ||
                          selectedInterval === scheduler?.intervalHours
                        }
                        variant="outline"
                        data-testid="button-update-interval"
                      >
                        {t("admin.scheduler.update_interval")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.scheduler.how_it_works")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    • {t("admin.scheduler.how_it_works_1")}
                  </p>
                  <p>
                    • {t("admin.scheduler.how_it_works_2")}
                  </p>
                  <p>
                    • {t("admin.scheduler.how_it_works_3")}
                  </p>
                  <p>
                    • {t("admin.scheduler.how_it_works_4")}
                  </p>
                  <p>
                    • {t("admin.scheduler.how_it_works_5")}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
    </div>
  );
}
