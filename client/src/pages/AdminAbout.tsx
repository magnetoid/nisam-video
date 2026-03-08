import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, FileText, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AdminAbout() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const { data: aboutData, isLoading } = useQuery({
    queryKey: ["/api/about"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/about");
      const data = await res.json();
      return data;
    },
  });

  // Initialize content when data is loaded
  useState(() => {
    if (aboutData?.content) {
      setContent(aboutData.content);
    }
  });

  // Update local state when data changes (e.g. first load)
  if (aboutData?.content && content === "" && !isLoading) {
    setContent(aboutData.content);
  }

  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const res = await apiRequest("POST", "/api/about", { content: newContent });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/about"] });
      toast({
        title: t("common.success", "Success"),
        description: t("admin.aboutSaved", "About page content updated successfully"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.aboutSaveFailed", "Failed to update about page content"),
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(content);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.editAboutPage", "Edit About Page")}</h1>
          <p className="text-muted-foreground">
            {t("admin.editAboutPageDesc", "Customize the content displayed on the public About page")}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saveMutation.isPending ? t("common.saving", "Saving...") : t("common.saveContent", "Save Content")}
        </Button>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("common.edit", "Edit")}
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {t("common.preview", "Preview")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.aboutPageContent", "About Page Content")}</CardTitle>
              <CardDescription>
                {t("admin.aboutContentDesc", "Edit the markdown content. HTML is supported but Markdown is recommended.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[500px] font-mono"
                  placeholder={t("admin.aboutPlaceholder", "# About Us\n\nWrite your content here...")}
                />
              )}
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
                <CardTitle>{t("admin.markdownGuide", "Markdown Formatting Guide")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground grid grid-cols-2 gap-4">
                <div>
                    <code className="text-xs bg-muted p-1 rounded"># Heading 1</code> - {t("admin.mdH1", "Main Title")}<br/>
                    <code className="text-xs bg-muted p-1 rounded">## Heading 2</code> - {t("admin.mdH2", "Section Title")}<br/>
                    <code className="text-xs bg-muted p-1 rounded">**Bold**</code> - <strong>{t("admin.mdBold", "Bold Text")}</strong><br/>
                    <code className="text-xs bg-muted p-1 rounded">*Italic*</code> - <em>{t("admin.mdItalic", "Italic Text")}</em>
                </div>
                <div>
                    <code className="text-xs bg-muted p-1 rounded">- List item</code> - {t("admin.mdList", "Bullet point")}<br/>
                    <code className="text-xs bg-muted p-1 rounded">[Link](url)</code> - {t("admin.mdLink", "Hyperlink")}<br/>
                    <code className="text-xs bg-muted p-1 rounded">![Alt](img)</code> - {t("admin.mdImage", "Image")}<br/>
                    <code className="text-xs bg-muted p-1 rounded">&gt; Quote</code> - {t("admin.mdQuote", "Blockquote")}
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("common.preview", "Preview")}</CardTitle>
              <CardDescription>
                {t("admin.aboutPreviewDesc", "This is how the page will look to visitors")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-slate dark:prose-invert max-w-none border rounded-md p-6 min-h-[500px]">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
