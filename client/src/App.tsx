import { lazy, Suspense, useEffect, LazyExoticComponent, ComponentType, Component, ReactNode } from "react";
import { Switch, Route } from "wouter";
import { queryClient, prefetchHomeData } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CustomCodeInjector } from "@/components/CustomCodeInjector";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorReporter } from "@/components/ErrorReporter";
import Home from "@/pages/Home";
import VideoPage from "@/pages/VideoPage";
import Categories from "@/pages/Categories";
import Tags from "@/pages/Tags";
import Popular from "@/pages/Popular";
import Shorts from "@/pages/Shorts";
import Donate from "@/pages/Donate";
import Login from "@/pages/Login";
import About from "@/pages/About";
import PublicLog from "@/pages/PublicLog";
import PublicErrorLogs from "@/pages/PublicErrorLogs";
import NotFound from "@/pages/not-found";
import CategoryPage from "@/pages/CategoryPage";
import TagPage from "@/pages/TagPage";
import "./i18n/config";

const adminPages = {
  dashboard: lazy(() => import("@/pages/AdminDashboard")),
  channels: lazy(() => import("@/pages/AdminChannels")),
  videos: lazy(() => import("@/pages/AdminVideos")),
  categories: lazy(() => import("@/pages/AdminCategories")),
  tags: lazy(() => import("@/pages/AdminTags")),
  automation: lazy(() => import("@/pages/AdminAutomation")),
  analytics: lazy(() => import("@/pages/AdminAnalytics")),
  analyticsConfig: lazy(() => import("@/pages/AdminAnalyticsConfig")),
  playlists: lazy(() => import("@/pages/AdminPlaylists")),
  seo: lazy(() => import("@/pages/AdminSEO")),
  seoEnhanced: lazy(() => import("@/pages/AdminSEOEnhanced")),
  export: lazy(() => import("@/pages/AdminDataExport")),
  settings: lazy(() => import("@/pages/AdminSystemSettings")),
  logs: lazy(() => import("@/pages/AdminActivityLogs")),
  cache: lazy(() => import("@/pages/AdminCacheSettings")),
  about: lazy(() => import("@/pages/AdminAbout")),
  tiktok: lazy(() => import("@/pages/AdminTikTok")),
  hero: lazy(() => import("@/pages/AdminHeroManagement")),
  clientLogs: lazy(() => import("@/pages/ClientLogs")),
  aiSettings: lazy(() => import("@/pages/AdminAISettings")),
};

type AdminPageKey = keyof typeof adminPages;

interface AdminRouteConfig {
  path: string;
  page: AdminPageKey;
}

const adminRoutes: AdminRouteConfig[] = [
  { path: "/admin/channels", page: "channels" },
  { path: "/admin/videos", page: "videos" },
  { path: "/admin/categories", page: "categories" },
  { path: "/admin/automation", page: "automation" },
  { path: "/admin/analytics", page: "analytics" },
  { path: "/admin/analytics/config", page: "analyticsConfig" },
  { path: "/admin/playlists", page: "playlists" },
  { path: "/admin/seo", page: "seo" },
  { path: "/admin/seo/enhanced", page: "seoEnhanced" },
  { path: "/admin/export", page: "export" },
  { path: "/admin/hero", page: "hero" },
  { path: "/admin/dashboard", page: "dashboard" },
  { path: "/admin/tags", page: "tags" },
  { path: "/admin/settings", page: "settings" },
  { path: "/admin/cache", page: "cache" },
  { path: "/admin/logs", page: "logs" },
  { path: "/admin/about", page: "about" },
  { path: "/admin/tiktok", page: "tiktok" },
  { path: "/admin/hero", page: "hero" },
  { path: "/admin/client-logs", page: "clientLogs" },
  { path: "/admin/ai-settings", page: "aiSettings" },
  { path: "/admin", page: "dashboard" },
];

function AdminLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    </div>
  );
}

async function clearCachesAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
  }

  window.location.reload();
}

class AdminErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown | null }
> {
  state: { error: unknown | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : "Admin page failed to load.";

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-xl font-semibold">Admin failed to load</h1>
            <p className="text-sm text-muted-foreground break-words">{message}</p>
            <div className="flex flex-col gap-2">
              <button
                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
                onClick={() => window.location.reload()}
                type="button"
              >
                Reload
              </button>
              <button
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium"
                onClick={() => void clearCachesAndReload()}
                type="button"
              >
                Reload (clear cache)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AdminRoute({ component: Component }: { component: LazyExoticComponent<ComponentType<any>> }) {
  return (
    <ProtectedRoute>
      <AdminErrorBoundary>
        <Suspense fallback={<AdminLoadingFallback />}>
          <Component />
        </Suspense>
      </AdminErrorBoundary>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/public/log" component={PublicLog} />
      <Route path="/video/:slug" component={VideoPage} />
      <Route path="/categories" component={Categories} />
      <Route path="/category/:slug" component={CategoryPage} />
      <Route path="/tags" component={Tags} />
      <Route path="/tag/:slug" component={TagPage} />
      <Route path="/popular" component={Popular} />
      <Route path="/shorts" component={Shorts} />
      <Route path="/about" component={About} />
      <Route path="/donate" component={Donate} />
      <Route path="/login" component={Login} />
      <Route path="/admin/login" component={Login} />
      <Route path="/public/error-logs" component={PublicErrorLogs} />
      {adminRoutes.map(({ path, page }) => (
        <Route key={path} path={path}>
          <AdminRoute component={adminPages[page]} />
        </Route>
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}

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
          <AnalyticsTracker>
            <Toaster />
            <Router />
          </AnalyticsTracker>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
