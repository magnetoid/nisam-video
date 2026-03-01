import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowUpRight,
  FileText,
  Settings,
  Share2,
  Tag,
} from "lucide-react";
import { SitemapAndRobotsPanel } from "@/pages/admin-seo/SitemapAndRobotsPanel";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type MetaTag = {
  id: string;
  pageUrl: string;
  pageType?: string;
  title: string;
  description: string;
  seoScore?: number | null;
  isActive?: boolean | null;
};

type RedirectRow = {
  id: string;
  fromUrl: string;
  toUrl: string;
  type?: "permanent" | "temporary";
  isActive?: boolean;
  hits?: number;
};

type KeywordRow = {
  id: string;
  keyword: string;
  searchVolume?: number | null;
  competition?: "low" | "medium" | "high" | null;
  difficulty?: number | null;
  currentRank?: number | null;
  targetRank?: number | null;
  ctr?: number | null;
};

type AuditRow = {
  id: string;
  auditType?: string;
  pageUrl: string;
  score?: number | null;
  createdAt?: string | null;
};

type MetaTagsResponse = { metaTags: MetaTag[]; pagination: Pagination };
type RedirectsResponse = { redirects: RedirectRow[]; pagination: Pagination };
type KeywordsResponse = { keywords: KeywordRow[]; pagination: Pagination };
type AuditsResponse = { audits: AuditRow[]; pagination: Pagination };

function optionalString(schema: z.ZodTypeAny) {
  return z.preprocess((v) => {
    if (typeof v === "string" && v.trim() === "") return undefined;
    return v;
  }, schema.optional());
}

const seoSettingsSchema = z.object({
  siteName: z.string().min(1).max(60),
  siteDescription: z.string().min(50).max(160),
  ogImage: optionalString(z.string().url()),
  metaKeywords: z.string().optional(),
  twitterHandle: z.string().optional(),
  googleSearchConsoleApiKey: z.string().optional(),
  bingWebmasterApiKey: z.string().optional(),
  enableAutoSitemapSubmission: z.boolean().optional(),
  enableSchemaMarkup: z.boolean().optional(),
  enableHreflang: z.boolean().optional(),
  enableABTesting: z.boolean().optional(),
  defaultLanguage: z.string().optional(),
  enableAMP: z.boolean().optional(),
  enablePWA: z.boolean().optional(),
  enableLocalSEO: z.boolean().optional(),
  businessName: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: optionalString(z.string().email()),
  businessHours: z.string().optional(),
  latitude: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().optional()),
  longitude: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().optional()),
});

type SeoSettingsFormValues = z.infer<typeof seoSettingsSchema>;

function splitLocation(location: string) {
  const idx = location.indexOf("?");
  if (idx === -1) return { path: location, query: "" };
  return { path: location.slice(0, idx), query: location.slice(idx + 1) };
}

function getTab(location: string) {
  const { query } = splitLocation(location);
  const params = new URLSearchParams(query);
  return params.get("tab") || "overview";
}

function setTabParam(path: string, query: string, tab: string) {
  const params = new URLSearchParams(query);
  if (tab === "overview") params.delete("tab");
  else params.set("tab", tab);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export default function AdminSEO() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { path, query } = splitLocation(location);
  const activeTab = getTab(location);

  const [metaSearch, setMetaSearch] = useState("");
  const [redirectSearch, setRedirectSearch] = useState("");
  const [keywordSearch, setKeywordSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery<SeoSettingsFormValues>({
    queryKey: ["/api/seo/enhanced/settings"],
  });

  const form = useForm<SeoSettingsFormValues>({
    resolver: zodResolver(seoSettingsSchema),
    defaultValues: {
      siteName: "nisam.video",
      siteDescription:
        "AI-powered video aggregation hub featuring curated content organized by intelligent categorization",
      metaKeywords: "",
      twitterHandle: "",
      enableSchemaMarkup: true,
      enableHreflang: true,
      defaultLanguage: "en",
      enableAutoSitemapSubmission: false,
      enableABTesting: false,
      enableAMP: false,
      enablePWA: false,
      enableLocalSEO: false,
    },
  });

  useEffect(() => {
    if (!settings) return;
    if (form.formState.isDirty) return;
    form.reset({
      ...form.getValues(),
      ...settings,
      metaKeywords: settings.metaKeywords || "",
      twitterHandle: settings.twitterHandle || "",
      googleSearchConsoleApiKey: settings.googleSearchConsoleApiKey || "",
      bingWebmasterApiKey: settings.bingWebmasterApiKey || "",
      businessName: settings.businessName || "",
      businessAddress: settings.businessAddress || "",
      businessPhone: settings.businessPhone || "",
      businessEmail: settings.businessEmail || "",
      businessHours: settings.businessHours || "",
      defaultLanguage: settings.defaultLanguage || "en",
    });
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SeoSettingsFormValues) => {
      await apiRequest("PATCH", "/api/seo/enhanced/settings", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/seo/enhanced/settings"] });
      toast({ title: "Saved", description: "SEO settings updated." });
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to update SEO settings",
        variant: "destructive",
      });
    },
  });

  const { data: metaResp, isLoading: metaLoading } = useQuery<MetaTagsResponse>({
    queryKey: ["/api/seo/enhanced/meta-tags", { page: 1, limit: 50, search: metaSearch || undefined }],
  });
  const metaTags = metaResp?.metaTags ?? [];

  const { data: redirectsResp, isLoading: redirectsLoading } = useQuery<RedirectsResponse>({
    queryKey: ["/api/seo/enhanced/redirects", { page: 1, limit: 50, search: redirectSearch || undefined }],
  });
  const redirects = redirectsResp?.redirects ?? [];

  const { data: keywordsResp, isLoading: keywordsLoading } = useQuery<KeywordsResponse>({
    queryKey: ["/api/seo/enhanced/keywords", { page: 1, limit: 50, search: keywordSearch || undefined }],
  });
  const keywords = keywordsResp?.keywords ?? [];

  const { data: auditsResp, isLoading: auditsLoading } = useQuery<AuditsResponse>({
    queryKey: ["/api/seo/enhanced/audits", { page: 1, limit: 50, pageUrl: auditSearch || undefined }],
  });
  const audits = auditsResp?.audits ?? [];

  const avgScore = useMemo(() => {
    const scores = metaTags.map((t) => (typeof t.seoScore === "number" ? t.seoScore : 0));
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [metaTags]);

  const schemaEnabled = !!form.watch("enableSchemaMarkup");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            SEO
          </h1>
              <p className="text-muted-foreground mt-1">
                Manage global and advanced SEO settings, meta tags, redirects, keywords, audits, and sitemap tools.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Unified</Badge>
              {schemaEnabled && <Badge className="bg-blue-600">Schema</Badge>}
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(tab) => setLocation(setTabParam(path, query, tab))}
          >
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="global">Global</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="meta-tags">Meta Tags</TabsTrigger>
              <TabsTrigger value="redirects">Redirects</TabsTrigger>
              <TabsTrigger value="sitemap">Sitemap & Robots</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Average SEO Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{avgScore}</div>
                    <div className="text-xs text-muted-foreground">Based on stored meta tags</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Redirects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{redirects.length}</div>
                    <div className="text-xs text-muted-foreground">Configured redirects</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{keywords.length}</div>
                    <div className="text-xs text-muted-foreground">Tracked keywords</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Audits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{audits.length}</div>
                    <div className="text-xs text-muted-foreground">Saved audit results</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="global" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Global SEO Configuration</CardTitle>
                  <CardDescription>Controls how your site appears in search and social shares.</CardDescription>
                </CardHeader>
                <CardContent>
                  {settingsLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading…</div>
                  ) : (
                    <Form {...form}>
                      <form
                        className="grid gap-6 lg:grid-cols-2"
                        onSubmit={form.handleSubmit((data) => updateSettingsMutation.mutate(data))}
                      >
                        <div className="space-y-6">
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
                                  <Input {...field} data-testid="input-site-name" />
                                </FormControl>
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
                                  <Textarea className="min-h-[120px]" {...field} />
                                </FormControl>
                                <FormDescription>Recommended 150–160 characters.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="ogImage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Open Graph Image URL</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="https://…" />
                                </FormControl>
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
                                  <Input {...field} value={field.value || ""} placeholder="comma,separated" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="twitterHandle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Twitter Handle</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Share2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="@nisamvideo" {...field} className="pl-9" value={field.value || ""} />
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  Used for Twitter Cards attribution
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" disabled={updateSettingsMutation.isPending}>
                            {updateSettingsMutation.isPending ? "Saving…" : "Save"}
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <Card className="border-dashed">
                            <CardHeader>
                              <CardTitle className="text-base">Preview</CardTitle>
                              <CardDescription>Example of how the homepage could appear.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="text-sm text-muted-foreground">https://nisam.video</div>
                              <div className="text-lg text-primary font-medium">
                                {form.watch("siteName") || "nisam.video"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {form.watch("siteDescription") || ""}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced SEO</CardTitle>
                  <CardDescription>Schema, localization, and integrations.</CardDescription>
                </CardHeader>
                <CardContent>
                  {settingsLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading…</div>
                  ) : (
                    <Form {...form}>
                      <form className="space-y-6" onSubmit={form.handleSubmit((data) => updateSettingsMutation.mutate(data))}>
                        <div className="grid gap-6 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="defaultLanguage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Default Language</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="en" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="googleSearchConsoleApiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Google Search Console API Key</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="optional" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="bingWebmasterApiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bing Webmaster API Key</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="optional" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="submit" disabled={updateSettingsMutation.isPending}>
                          {updateSettingsMutation.isPending ? "Saving…" : "Save"}
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meta-tags" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Meta Tags</CardTitle>
                  <CardDescription>Server-backed meta tags with SEO scores when available.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input value={metaSearch} onChange={(e) => setMetaSearch(e.target.value)} placeholder="Search by URL or title…" />
                    <Button type="button" variant="outline" onClick={() => setMetaSearch("")}>Clear</Button>
                  </div>
                  {metaLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading…</div>
                  ) : metaTags.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">No meta tags found.</div>
                  ) : (
                    <div className="space-y-3">
                      {metaTags.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-4 border rounded-lg p-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{t.title}</div>
                            <div className="text-sm text-muted-foreground truncate">{t.pageUrl}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof t.seoScore === "number" && <Badge variant="secondary">{t.seoScore}</Badge>}
                            {t.isActive === false && <Badge variant="outline">Inactive</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="redirects" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Redirects</CardTitle>
                  <CardDescription>Manage redirects to preserve SEO and prevent 404s.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input value={redirectSearch} onChange={(e) => setRedirectSearch(e.target.value)} placeholder="Search by from/to URL…" />
                    <Button type="button" variant="outline" onClick={() => setRedirectSearch("")}>Clear</Button>
                  </div>
                  {redirectsLoading ? (
                    <div className="py-8 text-center text-muted-foreground">Loading…</div>
                  ) : redirects.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">No redirects configured.</div>
                  ) : (
                    <div className="space-y-3">
                      {redirects.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-4 border rounded-lg p-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-sm truncate">{r.fromUrl}</div>
                            <div className="text-sm text-muted-foreground truncate">→ {r.toUrl}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof r.hits === "number" && <Badge variant="secondary">{r.hits} hits</Badge>}
                            {r.type && <Badge variant="outline">{r.type}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sitemap" className="space-y-4">
              <SitemapAndRobotsPanel
                defaultLanguage={form.watch("defaultLanguage") || "en"}
                onSavedRobots={() => toast({ title: "Saved", description: "robots.txt updated." })}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-2">
                  <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="inline-flex">
                    <Button variant="outline" className="gap-2" type="button">
                      <ArrowUpRight className="h-4 w-4" />
                      Open `/sitemap.xml`
                    </Button>
                  </a>
                  <a href="/robots.txt" target="_blank" rel="noreferrer" className="inline-flex">
                    <Button variant="outline" className="gap-2" type="button">
                      <ArrowUpRight className="h-4 w-4" />
                      Open `/robots.txt`
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </TabsContent>
      </Tabs>
    </div>
  );
}
