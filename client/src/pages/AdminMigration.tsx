import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PreflightCard } from "@/components/admin-migration/PreflightCard";
import { MigrationJobCard } from "@/components/admin-migration/MigrationJobCard";
import { CutoverCard, RollbackCard } from "@/components/admin-migration/CutoverRollbackCards";
import type { JobStatus, PreflightResponse } from "@/components/admin-migration/types";

export default function AdminMigration() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);

  const preflightQuery = useQuery<PreflightResponse>({
    queryKey: ["/api/admin/migration/preflight"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: false,
    retry: false,
  });

  const jobQuery = useQuery<JobStatus>({
    queryKey: jobId ? ["/api/admin/migration/jobs", jobId] : ["/api/admin/migration/jobs", "none"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const data = q.state.data as JobStatus | undefined;
      if (!data) return 2000;
      if (data.state === "running" || data.state === "queued") return 2000;
      return false;
    },
  });

  const startMutation = useMutation({
    mutationFn: async ({ mode, confirmText }: { mode: "full" | "incremental"; confirmText: string }) => {
      const res = await apiRequest("POST", "/api/admin/migration/start", {
        mode,
        confirmText,
      });
      return (await res.json()) as { jobId: string };
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      toast({
        title: t("admin.migrationStarted", "Migration started"),
        description: t("admin.migrationStartedDesc", "Track progress below."),
      });
    },
    onError: (e: any) => {
      toast({
        title: t("common.error", "Error"),
        description: e?.message ? String(e.message) : t("admin.migrationStartFailed", "Failed to start migration"),
        variant: "destructive",
      });
    },
  });

  const cutoverMutation = useMutation({
    mutationFn: async ({ confirmText }: { confirmText: string }) => {
      if (!jobId) throw new Error("No job selected");
      const res = await apiRequest("POST", "/api/admin/migration/cutover", {
        jobId,
        confirmText,
      });
      return (await res.json()) as { success: true };
    },
    onSuccess: async () => {
      toast({
        title: t("admin.cutoverDone", "Cutover completed"),
        description: t("admin.cutoverDoneDesc", "The app has switched database connections."),
      });
      await queryClient.invalidateQueries();
    },
    onError: (e: any) => {
      toast({
        title: t("common.error", "Error"),
        description: e?.message ? String(e.message) : t("admin.cutoverFailed", "Cutover failed"),
        variant: "destructive",
      });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ reason, confirmText }: { reason: string; confirmText: string }) => {
      const res = await apiRequest("POST", "/api/admin/migration/rollback", {
        reason,
        confirmText,
      });
      return (await res.json()) as { success: true };
    },
    onSuccess: async () => {
      toast({
        title: t("admin.rollbackDone", "Rollback completed"),
        description: t("admin.rollbackDoneDesc", "The app has reverted to the previous connection."),
      });
      await queryClient.invalidateQueries();
    },
    onError: (e: any) => {
      toast({
        title: t("common.error", "Error"),
        description: e?.message ? String(e.message) : t("admin.rollbackFailed", "Rollback failed"),
        variant: "destructive",
      });
    },
  });

  const job = jobQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("admin.migration", "Migration & Cutover")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "admin.migrationDesc",
            "Migrate data from the old database into the current one and perform a safe cutover.",
          )}
        </p>
      </div>

      <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <AlertTitle className="text-amber-100">{t("admin.migrationWarning", "High-risk operation")}</AlertTitle>
        <AlertDescription className="text-amber-100/80">
          {t(
            "admin.migrationWarningDesc",
            "Do this in a planned window. Credentials are never shown in the UI.",
          )}
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <PreflightCard
            data={preflightQuery.data}
            isFetching={preflightQuery.isFetching}
            onRun={() => preflightQuery.refetch()}
          />
          <MigrationJobCard
            jobId={jobId}
            job={job}
            isStarting={startMutation.isPending}
            onStart={(mode, confirmText) => startMutation.mutate({ mode, confirmText })}
          />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <CutoverCard
            enabled={Boolean(jobId) && job?.phase === "ready_for_cutover"}
            isPending={cutoverMutation.isPending}
            onCutover={(confirmText) => cutoverMutation.mutate({ confirmText })}
          />
          <RollbackCard
            isPending={rollbackMutation.isPending}
            onRollback={(reason, confirmText) => rollbackMutation.mutate({ reason, confirmText })}
          />
        </div>
      </div>
    </div>
  );
}

