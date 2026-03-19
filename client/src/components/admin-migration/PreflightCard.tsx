import { useTranslation } from "react-i18next";
import { Database, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PreflightResponse } from "@/components/admin-migration/types";
import { CheckBadge } from "@/components/admin-migration/types";

export function PreflightCard({
  data,
  isFetching,
  onRun,
}: {
  data: PreflightResponse | undefined;
  isFetching: boolean;
  onRun: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              {t("admin.preflight", "Preflight")}
            </CardTitle>
            <CardDescription>
              {t("admin.preflightDesc", "Verify connectivity, schema, and migration readiness.")}
            </CardDescription>
          </div>
          <Button onClick={onRun} disabled={isFetching} className="gap-2" data-testid="button-preflight">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {t("admin.runPreflight", "Run Preflight")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">{t("admin.sourceDb", "Source")}</div>
                <div className="mt-1 text-sm font-medium text-foreground break-all">
                  {data.context.source.maskedUrl || "Not configured"}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Badge variant={data.context.source.configured ? "secondary" : "destructive"}>
                    {data.context.source.configured ? "Configured" : "Missing"}
                  </Badge>
                  {data.context.source.sslEnabled != null && (
                    <Badge variant="outline">SSL: {String(data.context.source.sslEnabled)}</Badge>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">{t("admin.targetDb", "Target")}</div>
                <div className="mt-1 text-sm font-medium text-foreground break-all">
                  {data.context.target.maskedUrl || "Not configured"}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Badge variant={data.context.target.configured ? "secondary" : "destructive"}>
                    {data.context.target.configured ? "Configured" : "Missing"}
                  </Badge>
                  {data.context.target.sslEnabled != null && (
                    <Badge variant="outline">SSL: {String(data.context.target.sslEnabled)}</Badge>
                  )}
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              {data.checks.map((c) => (
                <div key={c.name} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{c.name}</div>
                    {c.message && <div className="text-xs text-muted-foreground break-all">{c.message}</div>}
                  </div>
                  <CheckBadge ok={c.ok} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            {t("admin.preflightEmpty", "Run preflight to see readiness checks.")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
