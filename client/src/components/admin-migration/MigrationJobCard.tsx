import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/components/admin-migration/types";
import { formatCounter } from "@/components/admin-migration/types";

export function MigrationJobCard({
  jobId,
  job,
  isStarting,
  onStart,
}: {
  jobId: string | null;
  job: JobStatus | undefined;
  isStarting: boolean;
  onStart: (mode: "full" | "incremental", confirmText: string) => void;
}) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState("");

  const validationSummary = useMemo(() => {
    if (!job?.counters) return [] as { label: string; source: string; target: string }[];
    const keys = ["channels", "videos", "categories"];
    return keys
      .map((k) => ({
        label: k,
        source: formatCounter(job.counters?.[`${k}.sourceCount`]),
        target: formatCounter(job.counters?.[`${k}.targetCount`]),
      }))
      .filter((x) => x.source !== "-" || x.target !== "-");
  }, [job?.counters]);

  const StartDialog = ({ mode, label, variant }: { mode: "full" | "incremental"; label: string; variant?: any }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="gap-2" variant={variant} disabled={isStarting} data-testid={`button-start-${mode}`}>
          {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.confirmStart", "Confirm migration")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.confirmStartDesc", "Type MIGRATE NOW to start. This may take a while.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`confirm-migrate-${mode}`}>Confirmation</Label>
          <Input
            id={`confirm-migrate-${mode}`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="MIGRATE NOW"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onStart(mode, confirmText)} disabled={confirmText !== "MIGRATE NOW" || isStarting}>
            {t("admin.start", "Start")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          {t("admin.migrationJob", "Migration Job")}
        </CardTitle>
        <CardDescription>
          {t("admin.migrationJobDesc", "Start a migration job. Full mode truncates the target before copying.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <StartDialog mode="full" label={t("admin.startFull", "Start Full Migration")} />
          <StartDialog mode="incremental" label={t("admin.startIncremental", "Start Incremental")} variant="secondary" />
        </div>

        {jobId && (
          <div className="rounded-lg border border-border p-4 space-y-3" data-testid="job-status">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">Job</div>
                <div className="text-xs text-muted-foreground break-all">{jobId}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{job?.state || "loading"}</Badge>
                <Badge variant="outline">{job?.phase || "-"}</Badge>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("admin.progress", "Progress")}</span>
                <span>{job?.progressPct ?? 0}%</span>
              </div>
              <Progress value={job?.progressPct ?? 0} />
            </div>

            {job?.errorMessage && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t("admin.jobFailed", "Migration failed")}</AlertTitle>
                <AlertDescription className="break-all">{job.errorMessage}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="logs">
              <TabsList>
                <TabsTrigger value="logs">{t("admin.logs", "Logs")}</TabsTrigger>
                <TabsTrigger value="counters">{t("admin.counters", "Counters")}</TabsTrigger>
                <TabsTrigger value="validation">{t("admin.validation", "Validation")}</TabsTrigger>
              </TabsList>
              <TabsContent value="logs" className="mt-3">
                <ScrollArea className="h-56 rounded-md border border-border bg-muted/20">
                  <div className="p-3 space-y-2 font-mono text-xs">
                    {(job?.logs || []).map((l, idx) => (
                      <div key={`${l.at}-${idx}`} className="flex gap-2">
                        <span className="text-muted-foreground">{new Date(l.at).toLocaleTimeString()}</span>
                        <span
                          className={cn(
                            l.level === "error" && "text-red-300",
                            l.level === "warn" && "text-amber-300",
                            l.level === "info" && "text-emerald-200",
                          )}
                        >
                          {l.level.toUpperCase()}
                        </span>
                        <span className="text-foreground/90 break-all">{l.message}</span>
                      </div>
                    ))}
                    {(job?.logs || []).length === 0 && (
                      <div className="text-muted-foreground">{t("admin.noLogs", "No logs yet")}</div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="counters" className="mt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(job?.counters || {}).slice(0, 24).map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border p-3">
                      <div className="text-xs text-muted-foreground break-all">{k}</div>
                      <div className="text-sm font-medium text-foreground">{formatCounter(v)}</div>
                    </div>
                  ))}
                  {Object.keys(job?.counters || {}).length === 0 && (
                    <div className="text-sm text-muted-foreground">{t("admin.noCounters", "No counters yet")}</div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="validation" className="mt-3">
                <div className="space-y-3">
                  {validationSummary.length > 0 ? (
                    validationSummary.map((v) => (
                      <div key={v.label} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div className="text-sm font-medium text-foreground">{v.label}</div>
                        <div className="text-xs text-muted-foreground">
                          source: <span className="text-foreground">{v.source}</span> · target:{" "}
                          <span className="text-foreground">{v.target}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t("admin.validationEmpty", "Validation will appear after migration.")}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

