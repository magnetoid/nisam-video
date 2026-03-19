import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PreflightCheck = { name: string; ok: boolean; message?: string };
export type PreflightResponse = {
  ok: boolean;
  checks: PreflightCheck[];
  context: {
    source: { configured: boolean; maskedUrl: string | null; sslEnabled: boolean | null };
    target: { configured: boolean; maskedUrl: string | null; sslEnabled: boolean | null };
    migrationsFolder: string | null;
  };
};

export type JobLog = { level: "info" | "warn" | "error"; message: string; at: string };
export type JobStatus = {
  jobId: string;
  state: "queued" | "running" | "failed" | "succeeded";
  phase:
    | "preparing"
    | "migrating_schema"
    | "copying"
    | "validating"
    | "ready_for_cutover"
    | "cutover"
    | "done";
  progressPct?: number;
  counters?: Record<string, number>;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  logs: JobLog[];
};

export function CheckBadge({ ok }: { ok: boolean }) {
  return (
    <Badge
      variant={ok ? "default" : "destructive"}
      className={cn(ok ? "bg-emerald-600 hover:bg-emerald-600" : "")}
    >
      {ok ? "PASS" : "FAIL"}
    </Badge>
  );
}

export function formatCounter(v: unknown) {
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string") return v;
  return "-";
}

