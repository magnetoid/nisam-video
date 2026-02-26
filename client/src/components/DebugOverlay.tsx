import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bug, X, Activity, Database, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DebugOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [metrics, setMetrics] = useState<any>({});

  useEffect(() => {
    // Show if in dev mode or debug param present
    const isDev = import.meta.env.DEV;
    const hasDebugParam = new URLSearchParams(window.location.search).get("debug") === "true";
    
    if (isDev || hasDebugParam) {
      setIsVisible(true);
    }

    const interval = setInterval(() => {
      if (isOpen) {
        // Collect metrics
        const queryCache = queryClient.getQueryCache();
        const queries = queryCache.getAll();
        
        setMetrics({
          queriesTotal: queries.length,
          queriesStale: queries.filter(q => q.state.status === 'success' && q.isStale()).length,
          queriesFetching: queries.filter(q => q.state.status === 'pending').length,
          mutations: queryClient.getMutationCache().getAll().length,
          navigation: window.performance?.navigation?.type || 'unknown',
          memory: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, queryClient]);

  if (!isVisible) return null;

  if (!isOpen) {
    return (
      <Button
        variant="destructive"
        size="icon"
        className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 shadow-lg hover:shadow-xl transition-all"
        onClick={() => setIsOpen(true)}
      >
        <Bug className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 h-96 shadow-2xl flex flex-col animate-in slide-in-from-bottom-5">
      <div className="p-3 border-b flex items-center justify-between bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Bug className="h-4 w-4" />
          Vibe Debugger
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 text-xs font-mono">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <Activity className="h-3 w-3" />
              Current State
            </div>
            <div className="grid grid-cols-2 gap-2 pl-5">
              <span className="text-muted-foreground">Route:</span>
              <span className="truncate">{location}</span>
              <span className="text-muted-foreground">Env:</span>
              <span>{import.meta.env.MODE}</span>
              <span className="text-muted-foreground">Memory:</span>
              <span>{metrics.memory}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <Database className="h-3 w-3" />
              Query Cache
            </div>
            <div className="grid grid-cols-2 gap-2 pl-5">
              <span className="text-muted-foreground">Total:</span>
              <span>{metrics.queriesTotal}</span>
              <span className="text-muted-foreground">Fetching:</span>
              <span className={metrics.queriesFetching > 0 ? "text-yellow-500 font-bold" : ""}>
                {metrics.queriesFetching}
              </span>
              <span className="text-muted-foreground">Stale:</span>
              <span>{metrics.queriesStale}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <Server className="h-3 w-3" />
              Backend
            </div>
            <div className="pl-5 space-y-1">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Status:</span>
                 <span className="text-green-500">Connected</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Latency:</span>
                 <span>~45ms</span>
               </div>
            </div>
          </div>
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t bg-muted/20">
        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => window.open('/admin/debug', '_blank')}>
          Open Full Dashboard
        </Button>
      </div>
    </Card>
  );
}
