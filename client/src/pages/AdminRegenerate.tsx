import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Sparkles,
  Tag,
  FolderTree,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { useTranslation } from "react-i18next";

export default function AdminRegenerate() {
  const { t } = useTranslation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [result, setResult] = useState<any>(null);
  const [regenerationMode] = useState<"missing">("missing");
  const { toast } = useToast();

  const { data: aiStatus } = useQuery<{
    openai: { configured: boolean; model: string; baseUrlConfigured: boolean };
  }>({
    queryKey: ["/api/admin/ai-status"],
  });

  const getErrorMessage = async (response: Response) => {
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await response.json();
        if (json?.error) return String(json.error);
      }
      const text = await response.text();
      return text || response.statusText;
    } catch {
      return response.statusText;
    }
  };

  const handleRegenerate = async (type: "all" | "categories" | "tags") => {
    setIsRegenerating(true);
    setProgress(0);
    setCurrentStep(t("admin.regenerate.starting"));
    setResult(null);

    try {
      const batchSize = 1;
      let offset = 0;
      let total = 0;
      let initialTotal = 0;
      let processedTotal = 0;
      let categoriesGeneratedTotal = 0;
      let tagsGeneratedTotal = 0;

      while (true) {
        const response = await fetch(
          `/api/admin/regenerate?type=${type}&offset=${offset}&limit=${batchSize}&mode=${regenerationMode}`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data = await response.json();

        if (regenerationMode === "missing" && data.total > 0 && (data.processed || 0) === 0) {
          throw new Error(t("admin.regenerate.no_progress_error"));
        }

        if (initialTotal === 0 && data.total > 0) {
          initialTotal = data.total;
        }

        total = typeof data.total === "number" ? data.total : total;
        processedTotal += data.processed || 0;
        categoriesGeneratedTotal += data.categoriesGenerated || 0;
        tagsGeneratedTotal += data.tagsGenerated || 0;

        if (regenerationMode === "missing") {
          offset = 0;
        } else {
          offset = typeof data.nextOffset === "number" ? data.nextOffset : offset + batchSize;
        }

        if (regenerationMode === "missing") {
          if (initialTotal > 0) {
            const pct = Math.min(100, Math.round((processedTotal / initialTotal) * 100));
            setProgress(pct);
            setCurrentStep(t("admin.regenerate.processing_missing", { processed: processedTotal, total: initialTotal }));
          }
        } else {
          if (total > 0) {
            const pct = Math.min(100, Math.round((offset / total) * 100));
            setProgress(pct);
            const end = Math.min(total, offset);
            setCurrentStep(t("admin.regenerate.processing_videos", { processed: end, total }));
          } else {
            setCurrentStep(t("admin.regenerate.processing"));
          }
        }

        if (data.done) {
          break;
        }

        // Small delay to prevent overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setProgress(100);
      setCurrentStep(t("admin.regenerate.completed"));
      setResult({
        success: true,
        processed: processedTotal,
        categoriesGenerated: categoriesGeneratedTotal,
        tagsGenerated: tagsGeneratedTotal,
        total,
      });

      toast({
        title: t("admin.regenerate.complete_title"),
        description: t("admin.regenerate.complete_desc", { count: processedTotal || 0 }),
      });
    } catch (error) {
      console.error("Regeneration error:", error);
      toast({
        title: t("admin.regenerate.failed_title"),
        description: t("admin.regenerate.failed_desc"),
        variant: "destructive",
      });
      setCurrentStep(t("common.failed", "Failed"));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRegenerateSlugs = async () => {
    setIsRegenerating(true);
    setProgress(0);
    setCurrentStep(t("admin.regenerate.regenerating_urls"));
    setResult(null);

    try {
      const batchSize = 200;
      let offset = 0;
      let total = 0;
      let processedTotal = 0;

      while (true) {
        const response = await fetch(
          `/api/admin/regenerate-slugs?offset=${offset}&limit=${batchSize}&mode=${regenerationMode}`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data = await response.json();

        if (regenerationMode === "missing" && data.total > 0 && (data.processed || 0) === 0) {
          throw new Error(t("admin.regenerate.no_progress_slugs_error"));
        }
        total = typeof data.total === "number" ? data.total : total;
        processedTotal += data.processed || 0;
        offset = typeof data.nextOffset === "number" ? data.nextOffset : offset + batchSize;

        if (total > 0) {
          const pct = Math.min(100, Math.round((offset / total) * 100));
          setProgress(pct);
          const end = Math.min(total, offset);
          setCurrentStep(t("admin.regenerate.updating_urls", { processed: end, total }));
        }

        if (data.done) {
          setResult({
            success: true,
            processed: processedTotal,
            total,
            type: "slugs",
            message: data.message,
          });
          break;
        }
      }

      setProgress(100);
      setCurrentStep(t("admin.regenerate.completed"));

      toast({
        title: t("admin.regenerate.url_complete_title"),
        description:
          t("admin.regenerate.url_complete_desc", { count: processedTotal || 0 }),
      });
    } catch (error) {
      console.error("Slug regeneration error:", error);
      toast({
        title: t("admin.regenerate.url_failed_title"),
        description: t("admin.regenerate.url_failed_desc"),
        variant: "destructive",
      });
      setCurrentStep(t("common.failed", "Failed"));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
        <div>
          <h1
            className="text-3xl font-bold text-foreground"
            data-testid="text-page-title"
          >
            {t("admin.regenerate.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.regenerate.subtitle")}
          </p>
          {aiStatus?.openai && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge variant="secondary">AI</Badge>
              <Badge variant={aiStatus.openai.configured ? "default" : "destructive"}>
                OpenAI: {aiStatus.openai.configured ? t("admin.regenerate.configured") : t("admin.regenerate.missing_key")}
              </Badge>
              <span className="text-muted-foreground">{t("admin.regenerate.model")}: {aiStatus.openai.model}</span>
            </div>
          )}

          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("admin.regenerate.mode_title")}</CardTitle>
              <CardDescription>{t("admin.regenerate.mode_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                defaultValue="missing"
                value={regenerationMode}
                onValueChange={() => {}}
                className="flex flex-col gap-4 sm:flex-row sm:gap-8"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="missing" id="missing" />
                  <Label htmlFor="missing" className="cursor-pointer">
                    <span className="font-medium">{t("admin.regenerate.missing_metadata")}</span>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.regenerate.missing_metadata_desc")}
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        {isRegenerating && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("admin.regenerate.regenerating")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{currentStep}</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                {t("admin.regenerate.regeneration_complete")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {result.type === "slugs"
                    ? t("admin.regenerate.urls_updated")
                    : t("admin.regenerate.videos_processed")}
                </span>
                <Badge variant="secondary">{result.processed || 0}</Badge>
              </div>
              {result.type !== "slugs" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t("admin.regenerate.categories_generated")}
                    </span>
                    <Badge variant="secondary">
                      {result.categoriesGenerated || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t("admin.regenerate.tags_generated")}
                    </span>
                    <Badge variant="secondary">
                      {result.tagsGenerated || 0}
                    </Badge>
                  </div>
                </>
              )}
              {result.message && (
                <p className="text-sm text-muted-foreground pt-2">
                  {result.message}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("admin.regenerate.categories_only")}</CardTitle>
              </div>
              <CardDescription>
                {t("admin.regenerate.categories_only_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleRegenerate("categories")}
                disabled={isRegenerating}
                className="w-full gap-2"
                variant="secondary"
                data-testid="button-regenerate-categories"
              >
                <FolderTree
                  className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`}
                />
                {t("admin.regenerate.regenerate_categories")}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("admin.regenerate.tags_only")}</CardTitle>
              </div>
              <CardDescription>
                {t("admin.regenerate.tags_only_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleRegenerate("tags")}
                disabled={isRegenerating}
                className="w-full gap-2"
                variant="secondary"
                data-testid="button-regenerate-tags"
              >
                <Tag
                  className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`}
                />
                {t("admin.regenerate.regenerate_tags")}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("admin.regenerate.seo_urls")}</CardTitle>
              </div>
              <CardDescription>{t("admin.regenerate.seo_urls_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleRegenerateSlugs}
                disabled={isRegenerating}
                className="w-full gap-2"
                variant="secondary"
                data-testid="button-regenerate-slugs"
              >
                <Link2
                  className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`}
                />
                {t("admin.regenerate.regenerate_urls")}
              </Button>
              <div className="mt-4 p-3 bg-muted rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {t("admin.regenerate.seo_urls_help")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.regenerate.important_info")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  {t("admin.regenerate.ai_powered")}
                </p>
                <p>
                  {t("admin.regenerate.ai_powered_desc")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <RefreshCw className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  {t("admin.regenerate.when_to_regenerate")}
                </p>
                <p>
                  {t("admin.regenerate.when_to_regenerate_desc")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">{t("admin.regenerate.processing_time")}</p>
                <p>
                  {t("admin.regenerate.processing_time_desc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
