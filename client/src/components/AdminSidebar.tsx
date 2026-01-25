import { Link, useLocation } from "wouter";
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
  Sliders,
  Download,
  RefreshCw,
  Database,
  FileText,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export function AdminSidebar() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        queryClient.clear();
        setLocation("/login");
        toast({
          title: t("common.success"),
          description: "Logged out successfully",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const menuItems = [
    { icon: Home, label: "Browse Site", path: "/", testId: "link-browse" },
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/admin/dashboard",
      testId: "link-dashboard",
    },
    {
      icon: Youtube,
      label: t("admin.channels"),
      path: "/admin/channels",
      testId: "link-channels",
    },
    {
      icon: SiTiktok,
      label: "TikTok",
      path: "/admin/tiktok",
      testId: "link-tiktok",
    },
    {
      icon: Video,
      label: t("admin.videos"),
      path: "/admin/videos",
      testId: "link-videos",
    },
    {
      icon: FolderTree,
      label: t("admin.categories"),
      path: "/admin/categories",
      testId: "link-categories",
    },
    { icon: Tag, label: "Tags", path: "/admin/tags", testId: "link-tags" },
    {
      icon: ListVideo,
      label: t("admin.playlists"),
      path: "/admin/playlists",
      testId: "link-playlists",
    },
    {
      icon: Clock,
      label: t("admin.scheduler"),
      path: "/admin/scheduler",
      testId: "link-scheduler",
    },
    {
      icon: BarChart3,
      label: t("admin.analytics"),
      path: "/admin/analytics",
      testId: "link-analytics",
    },
    {
      icon: RefreshCw,
      label: "Regenerate",
      path: "/admin/regenerate",
      testId: "link-regenerate",
    },
    {
      icon: Download,
      label: "Data Export",
      path: "/admin/export",
      testId: "link-export",
    },
    {
      icon: Database,
      label: "Cache Settings",
      path: "/admin/cache",
      testId: "link-cache",
    },
    {
      icon: FileText,
      label: "About Page",
      path: "/admin/about",
      testId: "link-about-admin",
    },
    {
      icon: Settings,
      label: t("admin.seo"),
      path: "/admin/seo",
      testId: "link-seo",
    },
    {
      icon: Sliders,
      label: "System Settings",
      path: "/admin/settings",
      testId: "link-settings",
    },
    {
      icon: Activity,
      label: "Activity Logs",
      path: "/admin/logs",
      testId: "link-logs",
    },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-60 bg-sidebar border-r border-sidebar-border overflow-y-auto z-40 flex flex-col">
      <nav className="p-4 space-y-2 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-primary"
                    : "text-sidebar-foreground hover-elevate"
                }`}
                data-testid={item.testId}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover-elevate"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  );
}
