import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminSidebar } from "@/components/AdminSidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SeoSettings } from "@shared/schema";
import { insertSeoSettingsSchema } from "@shared/schema";
import { Settings, Globe, Image, Tag } from "lucide-react";

export default function AdminSEO() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SeoSettings>) => {
      const response = await fetch("/api/seo/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/settings"] });
      toast({
        title: "SEO Settings Updated",
        description: "Your SEO configuration has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update SEO settings.",
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertSeoSettingsSchema),
    defaultValues: {
      siteName: "nisam.video",
      siteDescription:
        "AI-powered video aggregation hub featuring curated YouTube content organized by intelligent categorization",
      ogImage: "",
      metaKeywords: "",
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings && !form.formState.isDirty) {
      form.reset({
        siteName: settings.siteName,
        siteDescription: settings.siteDescription,
        ogImage: settings.ogImage || "",
        metaKeywords: settings.metaKeywords || "",
      });
    }
  }, [settings, form]);

  const onSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto ml-60 pt-16">
        <div className="p-8 max-w-4xl">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">SEO Settings</h1>
            </div>
            <p className="text-muted-foreground">
              Configure meta tags and SEO settings for your video hub
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Global SEO Configuration</CardTitle>
              <CardDescription>
                These settings control how your site appears in search engines
                and social media shares
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading settings...
                </div>
              ) : (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="siteName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Site Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="nisam.video"
                              {...field}
                              data-testid="input-site-name"
                            />
                          </FormControl>
                          <FormDescription>
                            The name of your website displayed in browser tabs
                            and search results
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="siteDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your video platform in a few sentences"
                              className="min-h-[100px]"
                              {...field}
                              data-testid="input-site-description"
                            />
                          </FormControl>
                          <FormDescription>
                            A brief description that appears in search engine
                            results (150-160 characters recommended)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ogImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            Open Graph Image URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/og-image.jpg"
                              {...field}
                              value={field.value || ""}
                              data-testid="input-og-image"
                            />
                          </FormControl>
                          <FormDescription>
                            Image displayed when sharing your site on social
                            media (1200x630px recommended)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="metaKeywords"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            Meta Keywords
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="video, youtube, aggregator, AI categorization"
                              {...field}
                              value={field.value || ""}
                              data-testid="input-meta-keywords"
                            />
                          </FormControl>
                          <FormDescription>
                            Comma-separated keywords for search engines
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      data-testid="button-save-seo"
                    >
                      {updateMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          {/* SEO Preview */}
          {settings && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  How your site might appear in search results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      https://nisam.video
                    </div>
                    <div className="text-lg text-primary font-medium">
                      {form.watch("siteName") || "nisam.video"}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {form.watch("siteDescription") ||
                        "AI-powered video aggregation hub"}
                    </div>
                  </div>

                  {form.watch("ogImage") && (
                    <div>
                      <div className="text-sm font-medium mb-2">
                        Social Media Share Preview
                      </div>
                      <div className="border rounded-lg overflow-hidden max-w-md">
                        <img
                          src={form.watch("ogImage") || ""}
                          alt="OG preview"
                          className="w-full h-auto"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="p-3 bg-card">
                          <div className="font-medium">
                            {form.watch("siteName")}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {form.watch("siteDescription")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
