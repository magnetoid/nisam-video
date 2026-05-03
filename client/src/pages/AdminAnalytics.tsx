import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemAnalyticsTab } from "@/components/admin-analytics/SystemAnalyticsTab";
import { VisitorAnalyticsTab } from "@/components/admin-analytics/VisitorAnalyticsTab";

export default function AdminAnalytics() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          {t("admin.analyticsDashboard", "Analytics Dashboard")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("admin.analyticsDashboardDesc", "Comprehensive system health and visitor insights")}
        </p>
      </div>

      <Tabs defaultValue="system" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="system">System Analytics</TabsTrigger>
          <TabsTrigger value="visitor">Visitor Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="system" className="mt-6">
          <SystemAnalyticsTab />
        </TabsContent>
        
        <TabsContent value="visitor" className="mt-6">
          <VisitorAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
