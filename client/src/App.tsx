import { Suspense, useEffect } from "react";
import { queryClient, prefetchHomeData } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomCodeInjector } from "@/components/CustomCodeInjector";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorReporter } from "@/components/ErrorReporter";
import { DebugOverlay } from "@/components/DebugOverlay";
import { AppRouter } from "@/Router";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AdminLoadingFallback } from "@/components/AdminErrorBoundary";
import "./i18n/config";

function App() {
  useEffect(() => {
    prefetchHomeData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <CustomCodeInjector />
          <ErrorReporter />
          <DebugOverlay />
          <AnalyticsTracker>
            <Toaster />
            <AppErrorBoundary>
              <Suspense fallback={<AdminLoadingFallback />}>
                <AppRouter />
              </Suspense>
            </AppErrorBoundary>
          </AnalyticsTracker>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
