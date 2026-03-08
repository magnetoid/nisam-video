import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Database, FileJson, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminDataExport() {
  const { t } = useTranslation();
  const [exportType, setExportType] = useState<string>("videos");
  const [format, setFormat] = useState<string>("json");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/export/${exportType}?format=${format}`,
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportType}-export-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t("admin.exportSuccessful", "Export Successful"),
        description: t("admin.exportDesc", { type: exportType, format: format.toUpperCase(), defaultValue: "{{type}} data exported as {{format}}" }),
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t("admin.exportFailed", "Export Failed"),
        description: t("admin.exportFailedDesc", "Failed to export data. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("admin.dataExport", "Data Export")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.dataExportDesc", "Export application data for backup or analysis")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("common.videos", "Videos")}</CardTitle>
              </div>
              <CardDescription>
                {t("admin.exportVideosDesc", "Export all video metadata, views, likes, and categories")}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("admin.channels", "Channels")}</CardTitle>
              </div>
              <CardDescription>
                {t("admin.exportChannelsDesc", "Export all channel information and statistics")}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("admin.analytics", "Analytics")}</CardTitle>
              </div>
              <CardDescription>
                {t("admin.exportAnalyticsDesc", "Export comprehensive analytics and engagement data")}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.configureExport", "Configure Export")}</CardTitle>
            <CardDescription>
              {t("admin.configureExportDesc", "Select the data type and format for export")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("admin.dataType", "Data Type")}
                </label>
                <Select value={exportType} onValueChange={setExportType}>
                  <SelectTrigger data-testid="select-export-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="videos">{t("common.videos", "Videos")}</SelectItem>
                    <SelectItem value="channels">{t("admin.channels", "Channels")}</SelectItem>
                    <SelectItem value="analytics">{t("admin.analytics", "Analytics")}</SelectItem>
                    <SelectItem value="categories">{t("admin.categories", "Categories")}</SelectItem>
                    <SelectItem value="tags">{t("admin.tags", "Tags")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("admin.format", "Format")}
                </label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger data-testid="select-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        <span>JSON</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>CSV</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="gap-2"
                data-testid="button-export"
              >
                <Download className="h-4 w-4" />
                {isExporting ? t("admin.exporting", "Exporting...") : t("admin.exportData", "Export Data")}
              </Button>
              <p className="text-sm text-muted-foreground">
                {t("admin.downloadStartAuto", "Download will start automatically")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.exportInfo", "Export Information")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <FileJson className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">{t("admin.jsonFormat", "JSON Format")}</p>
                <p>
                  {t("admin.jsonDesc", "Structured data format, ideal for programmatic access and data processing")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">{t("admin.csvFormat", "CSV Format")}</p>
                <p>
                  {t("admin.csvDesc", "Spreadsheet-compatible format, easy to open in Excel or Google Sheets")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
