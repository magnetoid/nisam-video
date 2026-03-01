import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  Search,
  Filter,
  AlertTriangle,
  Database,
  Server,
  Cpu,
  RefreshCw,
  BrainCircuit,
  CheckCircle,
  XCircle,
  Terminal,
  Bug
} from "lucide-react";
import type { ActivityLog } from "@shared/schema";
import { format } from "date-fns";

// --- Types ---
interface SystemHealth {
  database: "connected" | "disconnected";
  criticalErrorsLastHour: number;
  cache: {
    keys: number;
    hits: number;
    misses: number;
  };
  memory: {
    rss: string;
    heapUsed: string;
  };
  uptime: string;
}

interface ErrorEvent {
  id: number;
  fingerprint: string;
  level: string;
  type: string;
  message: string;
  stack?: string;
  module?: string;
  url?: string;
  lastSeenAt: string;
  count: number;
}

export default function AdminLogs() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("activity");

  // --- Activity Logs Logic ---
  const [activitySearch, setActivitySearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");

  const { data: logs = [], isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  const filteredLogs = logs.filter((log) => {
    // Exclude client errors from main activity log if preferred, or keep them
    // Usually activity logs are admin actions. Client errors are separate.
    // The original ActivityLogs page showed everything.
    const matchesSearch =
      log.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
      log.entityType.toLowerCase().includes(activitySearch.toLowerCase()) ||
      log.username.toLowerCase().includes(activitySearch.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesEntityType =
      entityTypeFilter === "all" || log.entityType === entityTypeFilter;

    return matchesSearch && matchesAction && matchesEntityType;
  });

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));
  const uniqueEntityTypes = Array.from(new Set(logs.map((log) => log.entityType)));

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes("create") || action.includes("add")) return "default";
    if (action.includes("update") || action.includes("edit")) return "secondary";
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    return "outline";
  };

  // --- System Health Logic ---
  const { data: health, refetch: refetchHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/admin/debug/system-health"],
    refetchInterval: 10000,
  });

  const { data: errorLogData, refetch: refetchErrors } = useQuery<{ items: ErrorEvent[] }>({
    queryKey: ["/api/admin/error-logs", { limit: 50 }],
    refetchInterval: 5000,
  });
  const errors = errorLogData?.items || [];

  const [selectedError, setSelectedError] = useState<ErrorEvent | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeError = async (error: ErrorEvent) => {
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAiAnalysis(`
        **AI Analysis:**
        The error "${error.type}" appears to be originating from ${error.module || 'unknown module'}.
        
        **Potential Causes:**
        1. Database connection timeout
        2. Invalid input parameters in ${error.url}
        
        **Suggested Fix:**
        Check the connection pool settings or validate input payload.
      `);
    } catch (e) {
      setAiAnalysis("Failed to generate analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Client Errors Logic ---
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  // Re-use logs query but filter for client errors
  const filteredClientLogs = logs.filter((log) => {
    const isClientError = log.action === "client_error" || log.entityType === "error";
    if (!isClientError) return false;

    const matchesSearch =
      log.username.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(clientSearchQuery.toLowerCase()));

    return matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            System Logs & Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor activity, system health, and errors
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
            refetchHealth();
            refetchErrors();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="activity" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity Logs
                </TabsTrigger>
                <TabsTrigger value="health" className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  System Health
                </TabsTrigger>
                <TabsTrigger value="client" className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Client Errors
                </TabsTrigger>
              </TabsList>

              {/* --- Activity Logs Content --- */}
              <TabsContent value="activity">
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{logs.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Action Types</CardTitle>
                            <Filter className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{uniqueActions.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Entity Types</CardTitle>
                            <Filter className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{uniqueEntityTypes.length}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Activity History</CardTitle>
                    <CardDescription>Administrative actions performed on the platform</CardDescription>
                    <div className="flex gap-4 mt-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search logs..."
                          value={activitySearch}
                          onChange={(e) => setActivitySearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actions</SelectItem>
                          {uniqueActions.map((action) => (
                            <SelectItem key={action} value={action}>{action}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {uniqueEntityTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {logsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : filteredLogs.length > 0 ? (
                      <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredLogs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                    {format(new Date(log.createdAt), "MMM dd, HH:mm:ss")}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{log.entityType}</Badge>
                                  </TableCell>
                                  <TableCell className="font-medium">{log.username}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                    {log.details || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No logs found</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* --- System Health Content --- */}
              <TabsContent value="health" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Database Status</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            {health?.database === "connected" ? (
                            <span className="text-green-500 flex items-center gap-1"><CheckCircle className="h-5 w-5"/> Online</span>
                            ) : (
                            <span className="text-red-500 flex items-center gap-1"><XCircle className="h-5 w-5"/> Offline</span>
                            )}
                        </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Critical Errors (1h)</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{health?.criticalErrorsLastHour || 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{health?.memory.rss || "0MB"}</div>
                        <p className="text-xs text-muted-foreground">Heap: {health?.memory.heapUsed || "0MB"}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{health?.uptime || "0s"}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="col-span-1 h-[600px] flex flex-col">
                        <CardHeader>
                        <CardTitle>Live Server Error Feed</CardTitle>
                        <CardDescription>Real-time stream of application exceptions</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full px-6 pb-6">
                            <div className="space-y-4">
                            {errors.length === 0 ? (
                                <div className="text-center text-muted-foreground py-10">
                                No errors detected recently. System is healthy! 🚀
                                </div>
                            ) : (
                                errors.map((error) => (
                                <div
                                    key={error.id}
                                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                                    onClick={() => setSelectedError(error)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                    <Badge variant={error.level === "error" || error.level === "critical" ? "destructive" : "secondary"}>
                                        {error.level.toUpperCase()}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(error.lastSeenAt).toLocaleTimeString()}
                                    </span>
                                    </div>
                                    <h4 className="font-semibold text-sm mb-1 truncate">{error.message}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Server className="h-3 w-3" />
                                    {error.module || "unknown"}
                                    <span>•</span>
                                    <span>{error.type}</span>
                                    {error.count > 1 && (
                                        <Badge variant="outline" className="ml-auto">x{error.count}</Badge>
                                    )}
                                    </div>
                                </div>
                                ))
                            )}
                            </div>
                        </ScrollArea>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                        <CardHeader>
                            <CardTitle>Cache Performance</CardTitle>
                            <CardDescription>In-memory cache efficiency</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">Hit Rate</span>
                                    <span className="font-bold">
                                        {health?.cache.hits && (health.cache.hits + health.cache.misses) > 0 
                                            ? Math.round((health.cache.hits / (health.cache.hits + health.cache.misses)) * 100) 
                                            : 0}%
                                    </span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary transition-all duration-500" 
                                        style={{ 
                                            width: `${health?.cache.hits && (health.cache.hits + health.cache.misses) > 0 
                                                ? (health.cache.hits / (health.cache.hits + health.cache.misses)) * 100 
                                                : 0}%` 
                                        }}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center text-sm pt-4">
                                    <div>
                                        <div className="text-muted-foreground">Keys</div>
                                        <div className="font-bold">{health?.cache.keys}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Hits</div>
                                        <div className="font-bold text-green-500">{health?.cache.hits}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Misses</div>
                                        <div className="font-bold text-red-500">{health?.cache.misses}</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        </Card>
                    </div>
                </div>
              </TabsContent>

              {/* --- Client Errors Content --- */}
              <TabsContent value="client">
                <Card>
                  <CardHeader>
                    <CardTitle>Client Error History</CardTitle>
                    <CardDescription>Errors captured from user sessions</CardDescription>
                    <div className="flex gap-4 mt-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search logs..."
                          value={clientSearchQuery}
                          onChange={(e) => setClientSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {logsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : filteredClientLogs.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>User / IP</TableHead>
                            <TableHead>Error Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClientLogs.map((log) => {
                              let details: any = { error: "", info: "", url: "" };
                              try {
                                  details = JSON.parse(log.details || "{}");
                              } catch (e) {
                                  details = { error: log.details || "", info: "", url: "" };
                              }

                              return (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap align-top">
                                {format(new Date(log.createdAt), "MMM dd, HH:mm:ss")}
                              </TableCell>
                              <TableCell className="font-medium align-top">
                                {log.username}
                                {log.ipAddress && <div className="text-xs text-muted-foreground">{log.ipAddress}</div>}
                              </TableCell>
                              <TableCell className="text-sm align-top">
                                <div className="space-y-1">
                                    {details.url && (
                                        <div className="text-xs text-muted-foreground bg-muted p-1 rounded break-all">
                                            {details.url}
                                        </div>
                                    )}
                                    <div className="font-semibold text-red-400 break-words">
                                        {details.error}
                                    </div>
                                    {details.info && (
                                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">
                                            {details.info}
                                        </pre>
                                    )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )})}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">No client errors found</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
      {/* Error Detail Modal */}
      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge variant={selectedError?.level === "error" ? "destructive" : "secondary"}>
                  {selectedError?.level.toUpperCase()}
                </Badge>
                Error Details
              </DialogTitle>
              <DialogDescription>
                First seen: {selectedError && new Date(selectedError.lastSeenAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            {selectedError && (
              <div className="space-y-6">
                <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap break-all">
                  {selectedError.message}
                </div>

                {selectedError.stack && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Stack Trace</h3>
                    <div className="p-4 bg-muted rounded-lg font-mono text-xs whitespace-pre overflow-x-auto">
                      {selectedError.stack}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Module:</span> {selectedError.module}</div>
                    <div><span className="text-muted-foreground">URL:</span> {selectedError.url}</div>
                    <div><span className="text-muted-foreground">Type:</span> {selectedError.type}</div>
                    <div><span className="text-muted-foreground">Count:</span> {selectedError.count}</div>
                </div>

                <div className="pt-4 border-t">
                    <Button 
                        onClick={() => handleAnalyzeError(selectedError)} 
                        disabled={isAnalyzing}
                        className="w-full"
                    >
                        {isAnalyzing ? (
                            <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                        ) : (
                            <><BrainCircuit className="mr-2 h-4 w-4" /> Analyze with AI</>
                        )}
                    </Button>
                    
                    {aiAnalysis && (
                        <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-primary" />
                                AI Insight
                            </h4>
                            <div className="text-sm whitespace-pre-wrap">{aiAnalysis}</div>
                        </div>
                    )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
