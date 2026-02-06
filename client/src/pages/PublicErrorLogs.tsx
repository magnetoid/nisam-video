import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PublicErrorEvent = {
  id: string;
  fingerprint: string;
  level: string;
  type: string;
  message: string;
  stack: string | null;
  module: string | null;
  url: string | null;
  method: string | null;
  statusCode: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
};

type ApiResponse = {
  items: PublicErrorEvent[];
};

function loadSavedToken(): string {
  try {
    return localStorage.getItem("publicErrorLogsToken") || "";
  } catch {
    return "";
  }
}

function saveToken(value: string): void {
  try {
    localStorage.setItem("publicErrorLogsToken", value);
  } catch {
    return;
  }
}

export default function PublicErrorLogs() {
  const [token, setToken] = useState(loadSavedToken);
  const [levels, setLevels] = useState("error,warn");
  const [q, setQ] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (token.trim()) params.set("token", token.trim());
    if (levels.trim()) params.set("levels", levels.trim());
    if (q.trim()) params.set("q", q.trim());
    params.set("limit", "200");
    return params.toString();
  }, [token, levels, q]);

  const { data, isFetching, refetch, error } = useQuery<ApiResponse>({
    queryKey: ["/api/public/error-logs", queryString],
    enabled: token.trim().length > 0,
    queryFn: async () => {
      const res = await fetch(`/api/public/error-logs?${queryString}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
      return (await res.json()) as ApiResponse;
    },
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Public Error Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Access token</div>
                <Input
                  value={token}
                  onChange={(e) => {
                    const value = e.target.value;
                    setToken(value);
                    saveToken(value);
                  }}
                  placeholder="Enter token"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Levels</div>
                <Input
                  value={levels}
                  onChange={(e) => setLevels(e.target.value)}
                  placeholder="error,warn"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Search</div>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="message / stack / module"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => refetch()}
                disabled={!token.trim() || isFetching}
              >
                {isFetching ? "Refreshing..." : "Refresh"}
              </Button>
              <div className="text-sm text-muted-foreground">
                {data?.items ? `${data.items.length} events` : ""}
              </div>
            </div>

            {error ? (
              <div className="text-sm text-red-500">{String((error as any)?.message || error)}</div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {(data?.items || []).map((e) => (
            <Card key={e.id}>
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={e.level === "error" || e.level === "critical" ? "destructive" : "secondary"}>
                      {e.level}
                    </Badge>
                    <div className="font-medium">{e.type}</div>
                    <div className="text-sm text-muted-foreground">×{e.count}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.lastSeenAt).toLocaleString()}
                  </div>
                </div>

                <div className="text-sm whitespace-pre-wrap break-words">{e.message}</div>

                <div className="text-xs text-muted-foreground">
                  {e.module ? `module: ${e.module}` : ""}
                  {e.url ? `  url: ${e.url}` : ""}
                  {e.statusCode ? `  status: ${e.statusCode}` : ""}
                </div>

                {e.stack ? (
                  <pre className="text-xs whitespace-pre-wrap break-words rounded-md bg-muted p-3 overflow-hidden">
                    {e.stack}
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

