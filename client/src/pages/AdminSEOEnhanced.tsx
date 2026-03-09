import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export default function AdminSEOEnhanced() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    setLocation("/admin/seo");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-sm text-muted-foreground">{t("common.redirecting", "Redirecting...")}</div>
    </div>
  );
}
