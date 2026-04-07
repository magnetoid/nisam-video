import { lazy, Suspense, LazyExoticComponent, ComponentType, ReactNode, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { SupportedLanguage } from "@shared/schema";
import { stripLanguagePrefix } from "@/lib/languageRouting";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminErrorBoundary, AdminLoadingFallback } from "@/components/AdminErrorBoundary";

// Critical pages loaded eagerly (landing + video - most common entries)
import Home from "@/pages/Home";
import VideoPage from "@/pages/VideoPage";
import NotFound from "@/pages/not-found";

// Lazy-loaded public pages (code-split for smaller initial bundle)
const Categories = lazy(() => import("@/pages/Categories"));
const Channels = lazy(() => import("@/pages/Channels"));
const ChannelPage = lazy(() => import("@/pages/ChannelPage"));
const Tags = lazy(() => import("@/pages/Tags"));
const Popular = lazy(() => import("@/pages/Popular"));
const Shorts = lazy(() => import("@/pages/Shorts"));
const Donate = lazy(() => import("@/pages/Donate"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Settings = lazy(() => import("@/pages/Settings"));
const About = lazy(() => import("@/pages/About"));
const PublicLog = lazy(() => import("@/pages/PublicLog"));
const PublicErrorLogs = lazy(() => import("@/pages/PublicErrorLogs"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const TagPage = lazy(() => import("@/pages/TagPage"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const FAQ = lazy(() => import("@/pages/FAQ"));

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
  inbox: lazy(() => import("@/pages/AdminInbox")),
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
  { path: "/admin/ai-settings", page: "aiSettings" },
  { path: "/admin/inbox", page: "inbox" },
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

function PageFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function LazyRoute({ component: Component }: { component: LazyExoticComponent<ComponentType<any>> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/video/:slug" component={VideoPage} />
      <Route path="/public/log">{() => <LazyRoute component={PublicLog} />}</Route>
      <Route path="/channels/:slug">{() => <LazyRoute component={ChannelPage} />}</Route>
      <Route path="/channels">{() => <LazyRoute component={Channels} />}</Route>
      <Route path="/categories">{() => <LazyRoute component={Categories} />}</Route>
      <Route path="/category/:slug">{() => <LazyRoute component={CategoryPage} />}</Route>
      <Route path="/tags">{() => <LazyRoute component={Tags} />}</Route>
      <Route path="/tag/:slug">{() => <LazyRoute component={TagPage} />}</Route>
      <Route path="/popular">{() => <LazyRoute component={Popular} />}</Route>
      <Route path="/shorts">{() => <LazyRoute component={Shorts} />}</Route>
      <Route path="/about">{() => <LazyRoute component={About} />}</Route>
      <Route path="/donate">{() => <LazyRoute component={Donate} />}</Route>
      <Route path="/privacy">{() => <LazyRoute component={PrivacyPolicy} />}</Route>
      <Route path="/terms">{() => <LazyRoute component={TermsOfService} />}</Route>
      <Route path="/faq">{() => <LazyRoute component={FAQ} />}</Route>
      <Route path="/login">{() => <LazyRoute component={Login} />}</Route>
      <Route path="/register">{() => <LazyRoute component={Register} />}</Route>
      <Route path="/settings">{() => <LazyRoute component={Settings} />}</Route>
      <Route path="/admin/login">{() => <LazyRoute component={Login} />}</Route>
      <Route path="/public/error-logs">{() => <LazyRoute component={PublicErrorLogs} />}</Route>
      {adminRoutes.map(({ path, page }) => (
        <Route key={path} path={path}>
          <AdminRoute component={adminPages[page]} />
        </Route>
      ))}
      <Route component={NotFound} />
    </Switch>
  );
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

  const routingLanguages = languages.map((l) => ({
    code: l.code,
    rootUri: l.rootUri,
    isDefault: l.isDefault,
  }));

  const { matched, base } = stripLanguagePrefix(location, routingLanguages);
  if (matched) {
    const langCode = matched.code;
    return (
      <WouterRouter base={base}>
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
