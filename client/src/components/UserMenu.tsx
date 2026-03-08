import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Settings, LogOut, LogIn, UserPlus, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function UserMenu() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["/api/auth/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      toast({
        title: t("common.success"),
        description: t("auth.logoutSuccess", "Logged out successfully"),
      });
      setLocation("/");
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("auth.logoutError", "Failed to logout"),
        variant: "destructive",
      });
    }
  };

  const isAuthenticated = session?.isAuthenticated;
  const isAdmin = session?.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="hover-elevate active-elevate-2 min-h-[44px] min-w-[44px]"
          data-testid="button-profile"
        >
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isAuthenticated ? (
          <>
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{session.username}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {isAdmin ? t("auth.roleAdmin", "Administrator") : t("auth.roleUser", "User")}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin/dashboard" className="cursor-pointer w-full flex items-center">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>{t("nav.admin", "Admin Dashboard")}</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer w-full flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>{t("nav.settings", "Settings")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("auth.logout", "Logout")}</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>{t("auth.account", "Account")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login" className="cursor-pointer w-full flex items-center">
                <LogIn className="mr-2 h-4 w-4" />
                <span>{t("auth.login", "Login")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/register" className="cursor-pointer w-full flex items-center">
                <UserPlus className="mr-2 h-4 w-4" />
                <span>{t("auth.register", "Register")}</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
