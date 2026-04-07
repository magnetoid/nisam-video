import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { Lock, User } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const { data: turnstileConfig } = useQuery<{ enabled: boolean; siteKey?: string }>({
    queryKey: ["/api/system/turnstile"],
    staleTime: 5 * 60 * 1000,
  });

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (turnstileConfig?.enabled && !turnstileToken) {
      toast({
        title: t("common.error", "Error"),
        description: t("auth.turnstileRequired", "Please complete the security verification"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      if (response.ok) {
        await queryClient.resetQueries({ queryKey: ["/api/auth/session"] });

        toast({
          title: t("common.success", "Success"),
          description: t("login.success", "Successfully logged in!"),
        });

        setTimeout(() => {
          window.location.href = "/admin/dashboard";
        }, 100);
      } else {
        const data = await response.json();
        toast({
          title: t("common.error", "Error"),
          description: data.error || t("login.invalidCredentials", "Invalid credentials"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error", "Error"),
        description: t("login.loginError", "Login failed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {t("login.title", "Admin Login")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("login.adminAccess", "Admin access")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.username", "Username")}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder={t("auth.username", "Username")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="pl-10"
                  data-testid="input-username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password", "Password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={t("auth.password", "Password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pl-10"
                  data-testid="input-password"
                />
              </div>
            </div>

            {turnstileConfig?.enabled && turnstileConfig.siteKey && (
              <TurnstileWidget
                siteKey={turnstileConfig.siteKey}
                onVerify={handleTurnstileVerify}
                onExpire={handleTurnstileExpire}
                theme="dark"
              />
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || (turnstileConfig?.enabled && !turnstileToken)}
              data-testid="button-login"
            >
              {isLoading ? t("login.loggingIn") : t("login.loginButton")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
