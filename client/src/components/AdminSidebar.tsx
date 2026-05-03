import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import {
  Home,
  Youtube,
  Video,
  FolderTree,
  Clock,
  BarChart3,
  ListVideo,
  Settings,
  LogOut,
  LayoutDashboard,
  Tag,
  Activity,
  Bug,
  Sliders,
  Star,
  Download,
  RefreshCw,
  Zap,
  Database,
  FileText,
  Bot,
  Users,
  Globe,
  Inbox,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
  className?: string;
}

export function AdminSidebar({ open = false, onClose, className }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) {
      onClose();
    }
  }, [location]);

  useEffect(() => {
    const common = [
      "/api/admin/categories",
      "/api/admin/tags",
      "/api/admin/cache/settings",
      "/api/admin/cache/stats",
      "/api/admin/hero/config",
      "/api/admin/hero/images",
    ];

    common.forEach((key) => {
      queryClient.prefetchQuery({
        queryKey: [key],
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
        meta: { silenceError: true },
      });
    });
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        queryClient.clear();
        setLocation("/login");
        toast({
          title: t("common.success", "Success"),
          description: t("auth.logoutSuccess", "Logged out successfully"),
        });
      }
    } catch (error) {
      toast({
        title: t("common.error", "Error"),
        description: t("auth.logoutFailed", "Failed to logout"),
        variant: "destructive",
      });
    }
  };

  const menuGroups = [
    {
      title: t("admin.overview", "Overview"),
      items: [
        { icon: Home, label: t("admin.browseSite", "Browse Site"), path: "/", testId: "link-browse" },
        {
          icon: LayoutDashboard,
          label: t("admin.dashboard", "Dashboard"),
          path: "/admin/dashboard",
          testId: "link-dashboard",
        },
        {
          icon: Inbox,
          label: t("admin.inbox", "Inbox"),
          path: "/admin/inbox",
          testId: "link-inbox",
        },
        {
          icon: Star,
          label: t("admin.heroManagement", "Hero Management"),
          path: "/admin/hero",
          testId: "link-hero",
        },
      ],
    },
    {
      title: t("admin.content", "Content"),
      items: [
        {
          icon: Youtube,
          label: t("admin.channels", "Channels"),
          path: "/admin/channels",
          testId: "link-channels",
        },
        {
          icon: SiTiktok,
          label: t("admin.tiktok", "TikTok"),
          path: "/admin/tiktok",
          testId: "link-tiktok",
        },
        {
          icon: Video,
          label: t("admin.videos", "Videos"),
          path: "/admin/videos",
          testId: "link-videos",
        },
        {
          icon: FolderTree,
          label: t("admin.categories", "Categories"),
          path: "/admin/categories",
          testId: "link-categories",
        },
        { icon: Tag, label: t("admin.tags", "Tags"), path: "/admin/tags", testId: "link-tags" },
        {
          icon: ListVideo,
          label: t("admin.playlists", "Playlists"),
          path: "/admin/playlists",
          testId: "link-playlists",
        },
      ],
    },
    {
      title: t("admin.system", "System"),
      items: [
        {
          icon: BookOpen,
          label: "Rules",
          path: "/admin/rules",
          testId: "link-rules",
        },
        {
          icon: Lightbulb,
          label: "Skills",
          path: "/admin/skills",
          testId: "link-skills",
        },
        {
          icon: Activity,
          label: t("admin.automation", "Automation"),
          path: "/admin/automation",
          testId: "link-automation",
        },
        {
          icon: Bot,
          label: t("admin.aiSettings", "AI Settings"),
          path: "/admin/ai-settings",
          testId: "link-ai-settings",
        },
        {
          icon: BarChart3,
          label: t("admin.analytics", "Analytics"),
          path: "/admin/analytics",
          testId: "link-analytics",
        },
        {
          icon: Download,
          label: t("admin.dataExport", "Data Export"),
          path: "/admin/export",
          testId: "link-export",
        },
        {
          icon: Database,
          label: t("admin.cacheSettings", "Cache Settings"),
          path: "/admin/cache",
          testId: "link-cache",
        },
        {
          icon: FileText,
          label: t("admin.aboutPage", "About Page"),
          path: "/admin/about",
          testId: "link-about-admin",
        },
        {
          icon: Settings,
          label: t("admin.seo", "SEO"),
          path: "/admin/seo",
          testId: "link-seo",
        },
        {
          icon: Globe,
          label: t("admin.translations", "Translations"),
          path: "/admin/languages",
          testId: "link-languages",
        },
        {
          icon: Sliders,
          label: t("admin.systemSettings", "System Settings"),
          path: "/admin/settings",
          testId: "link-settings",
        },
        {
          icon: Bug,
          label: t("admin.systemLogs", "System Logs"),
          path: "/admin/logs",
          testId: "link-logs",
        },
      ],
    },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed md:static top-16 left-0 h-[calc(100vh-64px)] w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto z-40 flex flex-col transition-transform duration-300 ease-in-out pb-4",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          className
        )}
      >
        <nav className="flex-1 py-4">
          {menuGroups.map((group, groupIndex) => (
            <div key={group.title} className="mb-6 last:mb-0">
              <h4 className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h4>
              <div className="space-y-1 px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;

                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group relative overflow-hidden",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                        data-testid={item.testId}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
                        )}
                        <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "")} />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-4 pt-4 border-t border-sidebar-border mt-auto">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span>{t("auth.logout", "Logout")}</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
