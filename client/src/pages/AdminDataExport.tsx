import { useState } from "react";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
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
        title: "Export Successful",
        description: `${exportType} data exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />
      <main className="ml-60 pt-16 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Export</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export application data for backup or analysis
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Videos</CardTitle>
              </div>
              <CardDescription>
                Export all video metadata, views, likes, and categories
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Channels</CardTitle>
              </div>
              <CardDescription>
                Export all channel information and statistics
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Analytics</CardTitle>
              </div>
              <CardDescription>
                Export comprehensive analytics and engagement data
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configure Export</CardTitle>
            <CardDescription>
              Select the data type and format for export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Data Type
                </label>
                <Select value={exportType} onValueChange={setExportType}>
                  <SelectTrigger data-testid="select-export-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="videos">Videos</SelectItem>
                    <SelectItem value="channels">Channels</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="categories">Categories</SelectItem>
                    <SelectItem value="tags">Tags</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Format
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
                {isExporting ? "Exporting..." : "Export Data"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Download will start automatically
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <FileJson className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">JSON Format</p>
                <p>
                  Structured data format, ideal for programmatic access and data
                  processing
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">CSV Format</p>
                <p>
                  Spreadsheet-compatible format, easy to open in Excel or Google
                  Sheets
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
