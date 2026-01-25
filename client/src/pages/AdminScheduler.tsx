import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminSidebar } from "@/components/AdminSidebar";
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
}

export default function AdminScheduler() {
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
        title: "Scheduler Started",
        description: "Automated scraping is now enabled",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start scheduler",
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
        title: "Scheduler Stopped",
        description: "Automated scraping has been disabled",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to stop scheduler",
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
        title: "Interval Updated",
        description: "Scraping interval has been changed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update interval",
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
        title: "Scrape Job Started",
        description: "Scraping all channels now",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start scrape job",
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "Never";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleString();
  };

  const getStatusBadge = () => {
    if (scheduler?.isRunning) {
      return (
        <Badge variant="default" className="bg-green-600">
          Running Job
        </Badge>
      );
    }
    if (scheduler?.isActive) {
      return (
        <Badge variant="default" className="bg-blue-600">
          Active
        </Badge>
      );
    }
    return <Badge variant="secondary">Stopped</Badge>;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 p-8 ml-[240px]">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              Automated Scheduler
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure automated scraping for all channels
            </p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Loading scheduler status...
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Scheduler Status</CardTitle>
                      <CardDescription>
                        Current status and schedule information
                      </CardDescription>
                    </div>
                    {getStatusBadge()}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Last Run</span>
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
                        <span>Next Run</span>
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
                      Scrape Interval
                    </p>
                    <p className="text-lg font-medium">
                      Every {scheduler?.intervalHours} hours
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Controls</CardTitle>
                  <CardDescription>
                    Manage the automated scraping scheduler
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    {scheduler?.isActive ? (
                      <Button
                        onClick={() => stopMutation.mutate()}
                        disabled={stopMutation.isPending}
                        variant="destructive"
                        className="gap-2"
                        data-testid="button-stop-scheduler"
                      >
                        <Square className="h-4 w-4" />
                        Stop Scheduler
                      </Button>
                    ) : (
                      <Button
                        onClick={() => startMutation.mutate()}
                        disabled={startMutation.isPending}
                        className="gap-2"
                        data-testid="button-start-scheduler"
                      >
                        <Play className="h-4 w-4" />
                        Start Scheduler
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
                      {scheduler?.isRunning ? "Scraping..." : "Run Now"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Scrape Interval
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
                          <SelectItem value="1">Every 1 hour</SelectItem>
                          <SelectItem value="6">Every 6 hours</SelectItem>
                          <SelectItem value="12">Every 12 hours</SelectItem>
                          <SelectItem value="24">Every 24 hours</SelectItem>
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
                        Update Interval
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    • The scheduler automatically scrapes all channels at the
                    configured interval
                  </p>
                  <p>
                    • New videos are added to the database and existing videos
                    are skipped
                  </p>
                  <p>
                    • Each channel's last scraped time is updated after
                    successful scraping
                  </p>
                  <p>
                    • You can manually trigger a scrape with "Run Now" at any
                    time
                  </p>
                  <p>
                    • The scheduler will continue running even after server
                    restarts
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
