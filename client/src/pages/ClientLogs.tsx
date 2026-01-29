import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, Search, AlertTriangle, Terminal } from "lucide-react";
import type { ActivityLog } from "@shared/schema";
import { format } from "date-fns";

export default function ClientLogs() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  // Filter for client errors
  const filteredLogs = logs.filter((log) => {
    const isClientError = log.action === "client_error" || log.entityType === "error";
    
    if (!isClientError) return false;

    const matchesSearch =
      log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />

      <main className="ml-60 pt-16 p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Terminal className="h-8 w-8" />
              Client Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              View errors reported from the client application
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Error History</CardTitle>
              <CardDescription>
                Errors captured from user sessions
              </CardDescription>

              <div className="flex gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading logs...
                </div>
              ) : filteredLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User / IP</TableHead>
                      <TableHead>Error Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                        let details = { error: "", info: "", url: "" };
                        try {
                            details = JSON.parse(log.details || "{}");
                        } catch (e) {
                            details = { error: log.details || "", info: "", url: "" };
                        }

                        return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap align-top">
                          {format(
                            new Date(log.createdAt),
                            "MMM dd, yyyy HH:mm:ss",
                          )}
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
                <div className="text-center py-8 text-muted-foreground">
                  No client errors found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}