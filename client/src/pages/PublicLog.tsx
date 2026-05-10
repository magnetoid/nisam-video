import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

type ErrorLogRow = {
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
  userId: string | null;
  sessionId: string | null;
  userAgent: string | null;
  ip: string | null;
  context: any;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
  bookmarked?: boolean;
  bookmarkNote?: string | null;
};

export default function PublicLog() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [type, setType] = useState("");
  const [module, setModule] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const queryKey = useMemo(
    () => [
      "/api/admin/error-logs",
      q,
      level,
      type,
      module,
      userId,
      from,
      to,
      cursor,
      bookmarkedOnly ? "1" : "0",
    ],
    [q, level, type, module, userId, from, to, cursor, bookmarkedOnly],
  );

  const { data, isLoading, error } = useQuery<{
    items: ErrorLogRow[];
    nextCursor: string | null;
  }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (level) params.set("level", level);
      if (type) params.set("type", type);
      if (module) params.set("module", module);
      if (userId) params.set("userId", userId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (cursor) params.set("cursor", cursor);
      if (bookmarkedOnly) params.set("bookmarked", "true");
      params.set("limit", "50");

      const res = await fetch(`/api/admin/error-logs?${params.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        throw new Error("401");
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch logs (${res.status})`);
      }

      return (await res.json()) as { items: ErrorLogRow[]; nextCursor: string | null };
    },
    meta: { silenceError: true },
  });

  const toggleBookmarkMutation = useMutation({
    mutationFn: async (payload: { fingerprint: string }) => {
      const res = await apiRequest("POST", "/api/admin/error-logs/bookmarks", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-logs"] });
    },
    meta: { silenceError: true },
  });

  useEffect(() => {
    const source = new EventSource("/api/admin/error-logs/stream");
    source.addEventListener("error_event", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-logs"] });
    });
    source.addEventListener("error", () => {
      source.close();
    });
    return () => {
      source.close();
    };
  }, []);

  const items = data?.items || [];
  const nextCursor = data?.nextCursor || null;

  const applyFilters = () => {
    setCursor(null);
    setExpanded(null);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/error-logs"] });
  };

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (level) params.set("level", level);
    if (type) params.set("type", type);
    if (module) params.set("module", module);
    if (userId) params.set("userId", userId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/admin/error-logs/export?${params.toString()}`;
  }, [q, level, type, module, userId, from, to]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onSearchClick={() => {}} />
      <main id="main-content" className="pt-16 flex-1">
        <div className="px-4 md:px-12 py-6 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{t("publicLogs.title", "Public Error Log")}</CardTitle>
                <Button variant="outline" asChild>
                  <a href={exportUrl}>{t("common.export", "Export")}</a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search", "Search")} />
                <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder={t("publicLogs.level", "Level")} />
                <Input value={type} onChange={(e) => setType(e.target.value)} placeholder={t("publicLogs.type", "Type")} />
                <Input value={module} onChange={(e) => setModule(e.target.value)} placeholder={t("publicLogs.module", "Module")} />
                <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t("publicLogs.userId", "User ID")} />
                <Button onClick={applyFilters} disabled={isLoading}>
                  {t("common.apply", "Apply")}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("publicLogs.fromISO", "From (ISO)")} />
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("publicLogs.toISO", "To (ISO)")} />
                <Button
                  variant={bookmarkedOnly ? "default" : "outline"}
                  onClick={() => {
                    setBookmarkedOnly((v) => !v);
                    setCursor(null);
                    setExpanded(null);
                  }}
                >
                  {t("publicLogs.bookmarked", "Bookmarked")}
                </Button>
              </div>
              {error instanceof Error && error.message === "401" && (
                <div className="text-sm text-muted-foreground">
                  {t("publicLogs.loginRequired", "Login required to view logs. Go to")} <a className="underline" href="/login">/login</a>.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("publicLogs.lastSeen", "Last Seen")}</TableHead>
                    <TableHead>{t("publicLogs.level", "Level")}</TableHead>
                    <TableHead>{t("publicLogs.type", "Type")}</TableHead>
                    <TableHead>{t("publicLogs.module", "Module")}</TableHead>
                    <TableHead>{t("publicLogs.message", "Message")}</TableHead>
                    <TableHead>{t("publicLogs.count", "Count")}</TableHead>
                    <TableHead className="text-right">{t("common.actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <Fragment key={row.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpanded((v) => (v === row.id ? null : row.id))}
                      >
                        <TableCell className="whitespace-nowrap">
                          {new Date(row.lastSeenAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.level === "critical" || row.level === "error" ? "destructive" : "secondary"}>
                            {row.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.type}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.module || "-"}</TableCell>
                        <TableCell className="max-w-[520px] truncate">{row.message}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.count}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmarkMutation.mutate({ fingerprint: row.fingerprint });
                            }}
                          >
                            <Star className={row.bookmarked ? "fill-current" : ""} />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded === row.id && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <div className="space-y-2 text-sm">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                  <div className="text-muted-foreground">{t("publicLogs.fingerprint", "Fingerprint")}</div>
                                  <div className="font-mono break-all">{row.fingerprint}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">{t("publicLogs.url", "URL")}</div>
                                  <div className="break-all">{row.url || "-"}</div>
                                </div>
                              </div>
                              {row.stack && (
                                <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs overflow-auto">
                                  {row.stack}
                                </pre>
                              )}
                              {row.context && (
                                <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs overflow-auto">
                                  {JSON.stringify(row.context, null, 2)}
                                </pre>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                  {!isLoading && items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("publicLogs.noLogsFound", "No logs found")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCursor(null);
                    setExpanded(null);
                  }}
                  disabled={!cursor}
                >
                  {t("publicLogs.firstPage", "First Page")}
                </Button>
                <Button
                  onClick={() => {
                    if (nextCursor) {
                      setCursor(nextCursor);
                      setExpanded(null);
                    }
                  }}
                  disabled={!nextCursor}
                >
                  {t("publicLogs.nextPage", "Next Page")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
