import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { User, Settings as SettingsIcon, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Settings() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const { data: session, isLoading } = useQuery({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
  });

  if (isLoading) return null;

  if (!session?.isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl mt-16">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          {t("settings.title", "User Settings")}
        </h1>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("settings.profile", "Profile Information")}
              </CardTitle>
              <CardDescription>
                {t("settings.profileDesc", "Manage your account details")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t("auth.username", "Username")}
                  </label>
                  <p className="text-lg font-medium">{session.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t("auth.role", "Role")}
                  </label>
                  <div className="flex items-center gap-2">
                    {session.role === "admin" && <Shield className="h-4 w-4 text-primary" />}
                    <p className="text-lg font-medium capitalize">{session.role}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Placeholder for future settings */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle>{t("settings.preferences", "Preferences")}</CardTitle>
              <CardDescription>
                {t("settings.preferencesDesc", "Customize your viewing experience (Coming Soon)")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline">
                {t("common.comingSoon", "Coming Soon")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
