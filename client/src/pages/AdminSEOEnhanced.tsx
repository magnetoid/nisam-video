import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import {
  Settings,
  Globe,
  Image,
  Tag,
  FileText,
  Search,
  BarChart3,
  Link,
  MapPin,
  Users,
  TrendingUp,
  Eye,
  Download,
  Upload,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Star,
  Target,
  Zap,
  Shield,
  Code,
  Smartphone,
  Monitor,
  Tablet,
} from "lucide-react";

// Enhanced SEO settings schema
const seoSettingsSchema = z.object({
  siteName: z.string().min(1, "Site name is required").max(60, "Site name too long"),
  siteDescription: z.string().min(50, "Description too short").max(160, "Description too long"),
  ogImage: z.string().url("Must be a valid URL").optional(),
  metaKeywords: z.string().optional(),
  googleSearchConsoleApiKey: z.string().optional(),
  bingWebmasterApiKey: z.string().optional(),
  enableAutoSitemapSubmission: z.boolean().default(false),
  enableSchemaMarkup: z.boolean().default(true),
  enableHreflang: z.boolean().default(true),
  enableABTesting: z.boolean().default(false),
  defaultLanguage: z.string().default("en"),
  enableAMP: z.boolean().default(false),
  enablePWA: z.boolean().default(false),
  robotsTxt: z.string().optional(),
  enableLocalSEO: z.boolean().default(false),
  businessName: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email().optional(),
  businessHours: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type SEOSettings = z.infer<typeof seoSettingsSchema>;

interface MetaTag {
  id: string;
  pageUrl: string;
  pageType: string;
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  canonicalUrl: string;
  schemaMarkup: any;
  isActive: boolean;
  seoScore: number;
  lastAuditedAt: string;
}

interface Redirect {
  id: string;
  fromUrl: string;
  toUrl: string;
  type: "permanent" | "temporary";
  isActive: boolean;
  createdAt: string;
  hits: number;
}

interface Keyword {
  id: string;
  keyword: string;
  searchVolume: number;
  competition: "low" | "medium" | "high";
  difficulty: number;
  currentRank: number;
  targetRank: number;
  clicks: number;
  impressions: number;
  ctr: number;
  lastUpdated: string;
}

interface AuditResult {
  id: string;
  auditType: string;
  pageUrl: string;
  score: number;
  issues: Array<{
    type: string;
    severity: "error" | "warning" | "info";
    message: string;
    suggestion: string;
  }>;
  recommendations: string[];
  createdAt: string;
}

interface ABTest {
  id: string;
  name: string;
  description: string;
  elementType: "title" | "description" | "og_title" | "og_description";
  pageUrl: string;
  variantA: string;
  variantB: string;
  trafficSplit: number;
  status: "draft" | "running" | "completed";
  winner: string;
  startDate: string;
  endDate: string;
  results: {
    variantA: { impressions: number; clicks: number; ctr: number };
    variantB: { impressions: number; clicks: number; ctr: number };
  };
}

interface Competitor {
  id: string;
  domain: string;
  name: string;
  targetKeywords: string[];
  backlinks: number;
  domainAuthority: number;
  organicTraffic: number;
  topPages: Array<{
    url: string;
    traffic: number;
    keywords: number;
  }>;
  lastAnalyzed: string;
}

export default function AdminSEOEnhanced() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMetaTag, setSelectedMetaTag] = useState<MetaTag | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Fetch SEO settings
  const { data: settings, isLoading: settingsLoading } = useQuery<SEOSettings>({
    queryKey: ["/api/seo/enhanced/settings"],
  });

  // Fetch meta tags
  const { data: metaTags = [], isLoading: metaTagsLoading } = useQuery<MetaTag[]>({
    queryKey: ["/api/seo/enhanced/meta-tags"],
  });

  // Fetch redirects
  const { data: redirects = [], isLoading: redirectsLoading } = useQuery<Redirect[]>({
    queryKey: ["/api/seo/enhanced/redirects"],
  });

  // Fetch keywords
  const { data: keywords = [], isLoading: keywordsLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/seo/enhanced/keywords"],
  });

  // Fetch audit results
  const { data: auditResults = [], isLoading: auditLoading } = useQuery<AuditResult[]>({
    queryKey: ["/api/seo/enhanced/audits"],
  });

  // Fetch A/B tests
  const { data: abTests = [], isLoading: abTestsLoading } = useQuery<ABTest[]>({
    queryKey: ["/api/seo/enhanced/ab-tests"],
  });

  // Fetch competitors
  const { data: competitors = [], isLoading: competitorsLoading } = useQuery<Competitor[]>({
    queryKey: ["/api/seo/enhanced/competitors"],
  });

  // Settings form
  const form = useForm<SEOSettings>({
    resolver: zodResolver(seoSettingsSchema),
    defaultValues: {
      siteName: "nisam.video",
      siteDescription: "AI-powered video aggregation hub featuring curated YouTube content organized by intelligent categorization",
      ogImage: "",
      metaKeywords: "",
      googleSearchConsoleApiKey: "",
      bingWebmasterApiKey: "",
      enableAutoSitemapSubmission: false,
      enableSchemaMarkup: true,
      enableHreflang: true,
      enableABTesting: false,
      defaultLanguage: "en",
      enableAMP: false,
      enablePWA: false,
      robotsTxt: "",
      enableLocalSEO: false,
      businessName: "",
      businessAddress: "",
      businessPhone: "",
      businessEmail: "",
      businessHours: "",
      latitude: 0,
      longitude: 0,
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings && !form.formState.isDirty) {
      form.reset(settings);
    }
  }, [settings, form]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SEOSettings) => {
      await apiRequest("PATCH", "/api/seo/enhanced/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/enhanced/settings"] });
      toast({
        title: "SEO Settings Updated",
        description: "Your SEO configuration has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update SEO settings",
        variant: "destructive",
      });
    },
  });

  // Create redirect mutation
  const createRedirectMutation = useMutation({
    mutationFn: async (data: Partial<Redirect>) => {
      await apiRequest("POST", "/api/seo/enhanced/redirects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/enhanced/redirects"] });
      toast({
        title: "Redirect Created",
        description: "301 redirect has been added successfully.",
      });
    },
  });

  // Delete redirect mutation
  const deleteRedirectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/seo/enhanced/redirects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/enhanced/redirects"] });
      toast({
        title: "Redirect Deleted",
        description: "Redirect has been removed successfully.",
      });
    },
  });

  // Run SEO audit mutation
  const runAuditMutation = useMutation({
    mutationFn: async (pageUrl: string) => {
      await apiRequest("POST", "/api/seo/enhanced/audits", { pageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seo/enhanced/audits"] });
      toast({
        title: "SEO Audit Started",
        description: "Audit is running in the background.",
      });
    },
  });

  const onSubmit = (data: SEOSettings) => {
    updateSettingsMutation.mutate(data);
  };

  const getSEOScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getSEOScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-600">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-600">Good</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  const getAuditStatusIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 p-8 ml-[240px]">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                SEO Enhancement Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Professional-grade SEO optimization and management tools
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Advanced</Badge>
              {settings?.enableSchemaMarkup && (
                <Badge className="bg-blue-600">Schema Enabled</Badge>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average SEO Score</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metaTags.length > 0 
                    ? Math.round(metaTags.reduce((acc, tag) => acc + (tag.seoScore || 0), 0) / metaTags.length)
                    : 0
                  }
                </div>
                <Progress 
                  value={metaTags.length > 0 
                    ? metaTags.reduce((acc, tag) => acc + (tag.seoScore || 0), 0) / metaTags.length
                    : 0
                  } 
                  className="mt-2" 
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Redirects</CardTitle>
                <Link className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{redirects.filter(r => r.isActive).length}</div>
                <p className="text-xs text-muted-foreground">
                  {redirects.reduce((acc, r) => acc + r.hits, 0).toLocaleString()} total hits
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tracked Keywords</CardTitle>
                <Search className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{keywords.length}</div>
                <p className="text-xs text-muted-foreground">
                  {keywords.filter(k => k.currentRank <= 10).length} in top 10
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Competitors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{competitors.length}</div>
                <p className="text-xs text-muted-foreground">
                  {competitors.filter(c => c.lastAnalyzed).length} analyzed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6 lg:grid-cols-8">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="meta-tags" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Meta Tags
              </TabsTrigger>
              <TabsTrigger value="redirects" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Redirects
              </TabsTrigger>
              <TabsTrigger value="keywords" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Keywords
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Tools
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* SEO Health Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>SEO Health Overview</CardTitle>
                  <CardDescription>Current status of your SEO optimization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Technical SEO</span>
                        <Badge className="bg-green-600">95%</Badge>
                      </div>
                      <Progress value={95} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">On-Page SEO</span>
                        <Badge className="bg-yellow-600">78%</Badge>
                      </div>
                      <Progress value={78} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Content Quality</span>
                        <Badge className="bg-green-600">88%</Badge>
                      </div>
                      <Progress value={88} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Audits */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent SEO Audits</CardTitle>
                      <CardDescription>Latest SEO analysis results</CardDescription>
                    </div>
                    <Button
                      onClick={() => runAuditMutation.mutate("/")}
                      disabled={runAuditMutation.isPending}
                      size="sm"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Run Audit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {auditResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No audits found. Run your first SEO audit to get started.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {auditResults.slice(0, 5).map((audit) => (
                        <div key={audit.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`text-2xl font-bold ${getSEOScoreColor(audit.score)}`}>
                              {audit.score}
                            </div>
                            <div>
                              <div className="font-medium">{audit.pageUrl}</div>
                              <div className="text-sm text-muted-foreground">
                                {audit.issues.length} issues found
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(audit.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* A/B Tests */}
              <Card>
                <CardHeader>
                  <CardTitle>Active A/B Tests</CardTitle>
                  <CardDescription>Running SEO optimization experiments</CardDescription>
                </CardHeader>
                <CardContent>
                  {abTests.filter(test => test.status === "running").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No active A/B tests. Create experiments to optimize your SEO performance.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {abTests.filter(test => test.status === "running").map((test) => (
                        <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{test.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {test.elementType} • {test.trafficSplit}% traffic
                            </div>
                          </div>
                          <Badge variant="default">Running</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Global SEO Settings</CardTitle>
                  <CardDescription>Configure your site's SEO foundation</CardDescription>
                </CardHeader>
                <CardContent>
                  {settingsLoading ? (
                    <div className="py-8 text-center text-muted-foreground">
                      Loading settings...
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
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
                                  <Input placeholder="nisam.video" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Your website name (max 60 characters)
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
                                  Open Graph Image
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="https://example.com/og-image.jpg"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  1200x630px recommended for social sharing
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="siteDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Site Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe your video platform..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                150-160 characters recommended for search results
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid gap-6 md:grid-cols-3">
                          <FormField
                            control={form.control}
                            name="enableSchemaMarkup"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Schema Markup</FormLabel>
                                  <FormDescription>
                                    Enable structured data for rich snippets
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="enableHreflang"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Hreflang Tags</FormLabel>
                                  <FormDescription>
                                    Multi-language SEO support
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="enableAutoSitemapSubmission"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Auto Sitemap</FormLabel>
                                  <FormDescription>
                                    Automatic submission to search engines
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="googleSearchConsoleApiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Search className="h-4 w-4" />
                                  Google Search Console API Key
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter your Google Search Console API key"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  For performance tracking and insights
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="bingWebmasterApiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bing Webmaster Tools API Key</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter your Bing Webmaster API key"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  For Bing search performance data
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="submit" disabled={updateSettingsMutation.isPending}>
                          {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meta-tags" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Meta Tag Management</h3>
                  <p className="text-sm text-muted-foreground">
                    Optimize titles, descriptions, and social media previews
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Page Meta Tags</CardTitle>
                  <CardDescription>SEO-optimized titles and descriptions for each page</CardDescription>
                </CardHeader>
                <CardContent>
                  {metaTagsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading meta tags...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {metaTags.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No meta tags found. Create your first meta tag to get started.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {metaTags.map((tag) => (
                            <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="font-medium">{tag.title}</div>
                                  <div className="text-sm text-muted-foreground">{tag.pageUrl}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getSEOScoreBadge(tag.seoScore)}
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="redirects" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">301 Redirects</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage URL redirects to prevent 404 errors and preserve SEO value
                  </p>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Redirect
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Active Redirects</CardTitle>
                  <CardDescription>Permanent redirects maintaining your site's link equity</CardDescription>
                </CardHeader>
                <CardContent>
                  {redirectsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading redirects...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {redirects.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No redirects configured. Add redirects to prevent 404 errors.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {redirects.map((redirect) => (
                            <div key={redirect.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="font-mono text-sm">{redirect.fromUrl}</div>
                                <div className="text-muted-foreground">→ {redirect.toUrl}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary">{redirect.hits} hits</Badge>
                                <Badge 
                                  variant={redirect.type === "permanent" ? "default" : "secondary"}
                                >
                                  {redirect.type}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteRedirectMutation.mutate(redirect.id)}
                                  disabled={deleteRedirectMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="keywords" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Keyword Research & Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor keyword rankings and discover new opportunities
                  </p>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Keyword
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Tracked Keywords</CardTitle>
                  <CardDescription>Monitor your keyword performance in search results</CardDescription>
                </CardHeader>
                <CardContent>
                  {keywordsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading keywords...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {keywords.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No keywords tracked. Add keywords to monitor your search rankings.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Keyword</TableHead>
                              <TableHead>Volume</TableHead>
                              <TableHead>Competition</TableHead>
                              <TableHead>Current Rank</TableHead>
                              <TableHead>CTR</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {keywords.map((keyword) => (
                              <TableRow key={keyword.id}>
                                <TableCell className="font-medium">{keyword.keyword}</TableCell>
                                <TableCell>{keyword.searchVolume?.toLocaleString() || "-"}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={
                                      keyword.competition === "low" ? "default" :
                                      keyword.competition === "medium" ? "secondary" :
                                      "destructive"
                                    }
                                  >
                                    {keyword.competition}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {keyword.currentRank ? (
                                    <Badge 
                                      variant={keyword.currentRank <= 10 ? "default" : "secondary"}
                                    >
                                      #{keyword.currentRank}
                                    </Badge>
                                  ) : (
                                    "Not ranked"
                                  )}
                                </TableCell>
                                <TableCell>{keyword.ctr ? `${keyword.ctr}%` : "-"}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm">
                                    <TrendingUp className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tools" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* SEO Audit Tool */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      SEO Audit
                    </CardTitle>
                    <CardDescription>Comprehensive site analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => runAuditMutation.mutate("/")}>
                      <Search className="h-4 w-4 mr-2" />
                      Run Full Audit
                    </Button>
                  </CardContent>
                </Card>

                {/* Sitemap Generator */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Sitemap Generator
                    </CardTitle>
                    <CardDescription>XML sitemap creation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      <Code className="h-4 w-4 mr-2" />
                      Generate Sitemap
                    </Button>
                  </CardContent>
                </Card>

                {/* Robots.txt Editor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Robots.txt
                    </CardTitle>
                    <CardDescription>Crawler instructions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Robots.txt
                    </Button>
                  </CardContent>
                </Card>

                {/* Schema Generator */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      Schema Generator
                    </CardTitle>
                    <CardDescription>Structured data markup</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Schema
                    </Button>
                  </CardContent>
                </Card>

                {/* Mobile Optimization */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Mobile SEO
                    </CardTitle>
                    <CardDescription>Mobile-first optimization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Analyze Mobile
                    </Button>
                  </CardContent>
                </Card>

                {/* Page Speed */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Page Speed
                    </CardTitle>
                    <CardDescription>Performance optimization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Test Speed
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}