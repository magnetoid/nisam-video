import { lazy, Suspense, LazyExoticComponent, ComponentType, ReactNode, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminErrorBoundary, AdminLoadingFallback } from "@/components/AdminErrorBoundary";

// Pages
import Home from "@/pages/Home";
import VideoPage from "@/pages/VideoPage";
import Categories from "@/pages/Categories";
import Channels from "@/pages/Channels";
import ChannelPage from "@/pages/ChannelPage";
import Tags from "@/pages/Tags";
import Popular from "@/pages/Popular";
import Shorts from "@/pages/Shorts";
import Donate from "@/pages/Donate";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Settings from "@/pages/Settings";
import About from "@/pages/About";
import PublicLog from "@/pages/PublicLog";
import PublicErrorLogs from "@/pages/PublicErrorLogs";
import NotFound from "@/pages/not-found";
import CategoryPage from "@/pages/CategoryPage";
import TagPage from "@/pages/TagPage";

const adminPages = {
  dashboard: lazy(() => import("@/pages/AdminDashboard")),
  channels: lazy(() => import("@/pages/AdminChannels")),
  videos: lazy(() => import("@/pages/AdminVideos")),
  categories: lazy(() => import("@/pages/AdminCategories")),
  tags: lazy(() => import("@/pages/AdminTags")),
  automation: lazy(() => import("@/pages/AdminAutomation")),
  analytics: lazy(() => import("@/pages/AdminAnalytics")),
  playlists: lazy(() => import("@/pages/AdminPlaylists")),
  seo: lazy(() => import("@/pages/AdminSEO")),
  seoEnhanced: lazy(() => import("@/pages/AdminSEOEnhanced")),
  export: lazy(() => import("@/pages/AdminDataExport")),
  settings: lazy(() => import("@/pages/AdminSystemSettings")),
  logs: lazy(() => import("@/pages/AdminLogs")),
  cache: lazy(() => import("@/pages/AdminCacheSettings")),
  about: lazy(() => import("@/pages/AdminAbout")),
  tiktok: lazy(() => import("@/pages/AdminTikTok")),
  hero: lazy(() => import("@/pages/AdminHeroManagement")),
  aiSettings: lazy(() => import("@/pages/AdminAISettings")),
  users: lazy(() => import("@/pages/AdminUsers")),
  languages: lazy(() => import("@/pages/AdminLanguages")),
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
  { path: "/admin/ai-settings", page: "aiSettings" },
  { path: "/admin/debug", page: "logs" },
  { path: "/admin/users", page: "users" },
  { path: "/admin/languages", page: "languages" },
  { path: "/admin", page: "dashboard" },
];

function AdminRoute({ component: Component }: { component: LazyExoticComponent<ComponentType<any>> }) {
  return (
    <ProtectedRoute>
      <AdminErrorBoundary>
        <AdminLayout>
          <Suspense fallback={<AdminLoadingFallback />}>
            <Component />
          </Suspense>
        </AdminLayout>
      </AdminErrorBoundary>
    </ProtectedRoute>
  );
}

function LanguageWrapper({ lang, children }: { lang: string, children: ReactNode }) {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    localStorage.setItem("language", lang);
  }, [lang, i18n]);
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/public/log" component={PublicLog} />
      <Route path="/video/:slug" component={VideoPage} />
      <Route path="/channels/:slug" component={ChannelPage} />
      <Route path="/channels" component={Channels} />
      <Route path="/categories" component={Categories} />
      <Route path="/category/:slug" component={CategoryPage} />
      <Route path="/tags" component={Tags} />
      <Route path="/tag/:slug" component={TagPage} />
      <Route path="/popular" component={Popular} />
      <Route path="/shorts" component={Shorts} />
      <Route path="/about" component={About} />
      <Route path="/donate" component={Donate} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/settings" component={Settings} />
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

interface SupportedLanguage {
  code: string;
  isDefault: boolean;
}

export function AppRouter() {
  const [location] = useLocation();

  // Fetch supported languages to know which ones are secondary (need prefix)
  const { data: languages = [], isLoading } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
    staleTime: Infinity, // Cache forever until reload
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const defaultLang = languages.find(l => l.isDefault)?.code || "sr-Latn";
  
  // Check if current path starts with any secondary language code
  // e.g. /en/..., /de/..., /fr/...
  // We need to match exactly /code or /code/
  const pathSegments = location.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];
  
  const matchedLang = languages.find(l => l.code === firstSegment && !l.isDefault);

  if (matchedLang) {
    const langCode = matchedLang.code;
    return (
      <WouterRouter base={`/${langCode}`}>
        <LanguageWrapper lang={langCode}>
          <AppRoutes />
        </LanguageWrapper>
      </WouterRouter>
    );
  }

  // Root path -> Primary Language (default)
  return (
    <LanguageWrapper lang={defaultLang}>
      <AppRoutes />
    </LanguageWrapper>
  );
}
