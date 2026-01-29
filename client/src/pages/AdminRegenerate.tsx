import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export default function AdminRegenerate() {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [result, setResult] = useState<any>(null);
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
    setCurrentStep("Starting regeneration...");
    setResult(null);

    try {
      const batchSize = 1;
      let offset = 0;
      let total = 0;
      let processedTotal = 0;
      let categoriesGeneratedTotal = 0;
      let tagsGeneratedTotal = 0;

      while (true) {
        const response = await fetch(
          `/api/admin/regenerate?type=${type}&offset=${offset}&limit=${batchSize}`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data = await response.json();

        total = typeof data.total === "number" ? data.total : total;
        processedTotal += data.processed || 0;
        categoriesGeneratedTotal += data.categoriesGenerated || 0;
        tagsGeneratedTotal += data.tagsGenerated || 0;

        offset = typeof data.nextOffset === "number" ? data.nextOffset : offset + batchSize;

        if (total > 0) {
          const pct = Math.min(100, Math.round((offset / total) * 100));
          setProgress(pct);
          const end = Math.min(total, offset);
          setCurrentStep(`Processing ${end} of ${total} videos...`);
        } else {
          setCurrentStep("Processing...");
        }

        if (data.done) {
          break;
        }
      }

      setProgress(100);
      setCurrentStep("Completed!");
      setResult({
        success: true,
        processed: processedTotal,
        categoriesGenerated: categoriesGeneratedTotal,
        tagsGenerated: tagsGeneratedTotal,
        total,
      });

      toast({
        title: "Regeneration Complete",
        description: `Successfully processed ${processedTotal || 0} videos`,
      });
    } catch (error) {
      console.error("Regeneration error:", error);
      toast({
        title: "Regeneration Failed",
        description: "Failed to regenerate content. Please try again.",
        variant: "destructive",
      });
      setCurrentStep("Failed");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRegenerateSlugs = async () => {
    setIsRegenerating(true);
    setProgress(0);
    setCurrentStep("Regenerating SEO-friendly URLs...");
    setResult(null);

    try {
      const batchSize = 200;
      let offset = 0;
      let total = 0;
      let processedTotal = 0;

      while (true) {
        const response = await fetch(
          `/api/admin/regenerate-slugs?offset=${offset}&limit=${batchSize}`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data = await response.json();
        total = typeof data.total === "number" ? data.total : total;
        processedTotal += data.processed || 0;
        offset = typeof data.nextOffset === "number" ? data.nextOffset : offset + batchSize;

        if (total > 0) {
          const pct = Math.min(100, Math.round((offset / total) * 100));
          setProgress(pct);
          const end = Math.min(total, offset);
          setCurrentStep(`Updating ${end} of ${total} URLs...`);
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
      setCurrentStep("Completed!");

      toast({
        title: "URL Regeneration Complete",
        description:
          `Successfully regenerated ${processedTotal || 0} video URLs`,
      });
    } catch (error) {
      console.error("Slug regeneration error:", error);
      toast({
        title: "URL Regeneration Failed",
        description: "Failed to regenerate URLs. Please try again.",
        variant: "destructive",
      });
      setCurrentStep("Failed");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />
      <main className="ml-60 pt-16 p-8 space-y-6">
        <div>
          <h1
            className="text-3xl font-bold text-foreground"
            data-testid="text-page-title"
          >
            Regenerate Content
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Use AI to regenerate categories and tags for all videos
          </p>
          {aiStatus?.openai && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge variant="secondary">AI</Badge>
              <Badge variant={aiStatus.openai.configured ? "default" : "destructive"}>
                OpenAI: {aiStatus.openai.configured ? "configured" : "missing key"}
              </Badge>
              <span className="text-muted-foreground">Model: {aiStatus.openai.model}</span>
            </div>
          )}
        </div>

        {isRegenerating && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Regenerating...
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
                Regeneration Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {result.type === "slugs"
                    ? "URLs Updated:"
                    : "Videos Processed:"}
                </span>
                <Badge variant="secondary">{result.processed || 0}</Badge>
              </div>
              {result.type !== "slugs" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Categories Generated:
                    </span>
                    <Badge variant="secondary">
                      {result.categoriesGenerated || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Tags Generated:
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
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Full Regeneration</CardTitle>
              </div>
              <CardDescription>
                Regenerate all AI categories and tags for every video in the
                system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleRegenerate("all")}
                disabled={isRegenerating}
                className="w-full gap-2"
                data-testid="button-regenerate-all"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`}
                />
                Regenerate All
              </Button>
              <div className="mt-4 p-3 bg-muted rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    This process uses AI and may take several minutes depending
                    on the number of videos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Categories Only</CardTitle>
              </div>
              <CardDescription>
                Regenerate only AI-generated categories for all videos
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
                Regenerate Categories
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Tags Only</CardTitle>
              </div>
              <CardDescription>
                Regenerate only AI-generated tags for all videos
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
                Regenerate Tags
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">SEO URLs</CardTitle>
              </div>
              <CardDescription>
                Regenerate SEO-friendly URLs (slugs) for all videos from their
                titles
              </CardDescription>
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
                Regenerate URLs
              </Button>
              <div className="mt-4 p-3 bg-muted rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Updates all video URLs to be SEO-friendly based on current
                    titles
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  AI-Powered Analysis
                </p>
                <p>
                  Uses OpenAI to analyze video titles and descriptions for
                  intelligent categorization
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <RefreshCw className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  When to Regenerate
                </p>
                <p>
                  Use this after importing new videos, or when you want to
                  refresh the AI analysis with updated algorithms
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Processing Time</p>
                <p>
                  The regeneration process may take several minutes. You can
                  continue using the site while this tab stays open
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
