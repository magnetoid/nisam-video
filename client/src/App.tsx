import { lazy, Suspense, useEffect, LazyExoticComponent, ComponentType } from "react";
import { Switch, Route } from "wouter";
import { queryClient, prefetchHomeData } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CustomCodeInjector } from "@/components/CustomCodeInjector";
import { ThemeProvider } from "@/components/ThemeProvider";
import Home from "@/pages/Home";
import VideoPage from "@/pages/VideoPage";
import Categories from "@/pages/Categories";
import Tags from "@/pages/Tags";
import Popular from "@/pages/Popular";
import Shorts from "@/pages/Shorts";
import Donate from "@/pages/Donate";
import Login from "@/pages/Login";
import About from "@/pages/About";
import NotFound from "@/pages/not-found";
import "./i18n/config";

const adminPages = {
  dashboard: lazy(() => import("@/pages/AdminDashboard")),
  channels: lazy(() => import("@/pages/AdminChannels")),
  videos: lazy(() => import("@/pages/AdminVideos")),
  categories: lazy(() => import("@/pages/AdminCategories")),
  tags: lazy(() => import("@/pages/AdminTags")),
  scheduler: lazy(() => import("@/pages/AdminScheduler")),
  analytics: lazy(() => import("@/pages/AdminAnalytics")),
  playlists: lazy(() => import("@/pages/AdminPlaylists")),
  seo: lazy(() => import("@/pages/AdminSEO")),
  export: lazy(() => import("@/pages/AdminDataExport")),
  regenerate: lazy(() => import("@/pages/AdminRegenerate")),
  settings: lazy(() => import("@/pages/AdminSystemSettings")),
  logs: lazy(() => import("@/pages/AdminActivityLogs")),
  cache: lazy(() => import("@/pages/AdminCacheSettings")),
  about: lazy(() => import("@/pages/AdminAbout")),
  tiktok: lazy(() => import("@/pages/AdminTikTok")),
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
  { path: "/admin/scheduler", page: "scheduler" },
  { path: "/admin/analytics", page: "analytics" },
  { path: "/admin/playlists", page: "playlists" },
  { path: "/admin/seo", page: "seo" },
  { path: "/admin/export", page: "export" },
  { path: "/admin/regenerate", page: "regenerate" },
  { path: "/admin/dashboard", page: "dashboard" },
  { path: "/admin/tags", page: "tags" },
  { path: "/admin/settings", page: "settings" },
  { path: "/admin/cache", page: "cache" },
  { path: "/admin/logs", page: "logs" },
  { path: "/admin/about", page: "about" },
  { path: "/admin/tiktok", page: "tiktok" },
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

function AdminRoute({ component: Component }: { component: LazyExoticComponent<ComponentType<any>> }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<AdminLoadingFallback />}>
        <Component />
      </Suspense>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/video/:slug" component={VideoPage} />
      <Route path="/categories" component={Categories} />
      <Route path="/tags" component={Tags} />
      <Route path="/popular" component={Popular} />
      <Route path="/shorts" component={Shorts} />
      <Route path="/about" component={About} />
      <Route path="/donate" component={Donate} />
      <Route path="/login" component={Login} />
      <Route path="/admin/login" component={Login} />
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
