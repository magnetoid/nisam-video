import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  VideoIcon,
  FolderIcon,
  TagIcon,
  TvIcon,
} from "lucide-react";

interface AnalyticsData {
  totals: {
    channels: number;
    videos: number;
    categories: number;
    tags: number;
    allTimeVideos: number;
  };
  topCategories: Array<{ name: string; count: number }>;
  channelPerformance: Array<{ name: string; videoCount: number }>;
  categoryDistribution: Array<{ name: string; count: number }>;
  topTags: Array<{ name: string; count: number }>;
}

const COLORS = [
  "#E50914",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
];

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<string>("all");

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange !== "all") {
        params.append("days", dateRange);
      }
      const url = `/api/analytics${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {t("admin.analyticsDashboard", "Analytics Dashboard")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.analyticsDashboardDesc", "Comprehensive statistics and insights")}
          </p>
        </div>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]" data-testid="select-date-range">
            <SelectValue placeholder={t("admin.selectRange", "Select range")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.allTime", "All Time")}</SelectItem>
            <SelectItem value="7">{t("admin.last7Days", "Last 7 Days")}</SelectItem>
            <SelectItem value="30">{t("admin.last30Days", "Last 30 Days")}</SelectItem>
            <SelectItem value="90">{t("admin.last90Days", "Last 90 Days")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">{t("admin.loadingAnalytics", "Loading analytics...")}</div>
            </div>
          ) : analytics ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("admin.totalChannels", "Total Channels")}
                    </CardTitle>
                    <TvIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="stat-total-channels"
                    >
                      {analytics.totals.channels}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("admin.totalVideos", "Total Videos")}
                    </CardTitle>
                    <VideoIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="stat-total-videos"
                    >
                      {analytics.totals.videos}
                    </div>
                    {dateRange !== "all" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("admin.ofAllTime", { count: analytics.totals.allTimeVideos, defaultValue: "of {{count}} all-time" })}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("admin.categories", "Categories")}
                    </CardTitle>
                    <FolderIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="stat-total-categories"
                    >
                      {analytics.totals.categories}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {t("admin.totalTags", "Total Tags")}
                    </CardTitle>
                    <TagIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className="text-2xl font-bold"
                      data-testid="stat-total-tags"
                    >
                      {analytics.totals.tags}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Categories Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      {t("admin.topCategories", "Top 5 Categories")}
                    </CardTitle>
                    <CardDescription>{t("admin.videosByCategory", "Videos by category")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.topCategories.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics.topCategories}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                          />
                          <XAxis
                            dataKey="name"
                            stroke="hsl(var(--foreground))"
                          />
                          <YAxis stroke="hsl(var(--foreground))" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                          />
                          <Bar dataKey="count" fill="#E50914" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        {t("admin.noCategoryData", "No category data available")}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Category Distribution Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("admin.categoryDistribution", "Category Distribution")}</CardTitle>
                    <CardDescription>
                      {t("admin.videoDistribution", "Video distribution across categories")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.categoryDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analytics.categoryDistribution.slice(0, 8)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name}: ${(percent * 100).toFixed(0)}%`
                            }
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {analytics.categoryDistribution
                              .slice(0, 8)
                              .map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        {t("admin.noDistributionData", "No distribution data available")}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Channel Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      {t("admin.channelPerformance", "Channel Performance")}
                    </CardTitle>
                    <CardDescription>{t("admin.videosPerChannel", "Videos per channel")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.channelPerformance.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={analytics.channelPerformance.slice(0, 10)}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                          />
                          <XAxis
                            dataKey="name"
                            stroke="hsl(var(--foreground))"
                            angle={-45}
                            textAnchor="end"
                            height={100}
                          />
                          <YAxis stroke="hsl(var(--foreground))" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                          />
                          <Bar dataKey="videoCount" fill="#4ECDC4" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        {t("admin.noChannelData", "No channel data available")}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Tags */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TagIcon className="h-5 w-5" />
                      {t("admin.trendingTags", "Trending Tags")}
                    </CardTitle>
                    <CardDescription>{t("admin.topTagsDesc", "Top 20 most used tags")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.topTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                        {analytics.topTags.map((tag, index) => (
                          <div
                            key={tag.name}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/50"
                            style={{
                              fontSize: `${Math.max(0.75, Math.min(1.25, 0.75 + (tag.count / analytics.topTags[0].count) * 0.5))}rem`,
                            }}
                          >
                            <span className="font-medium">{tag.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ×{tag.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        {t("admin.noTagsAvailable", "No tags available")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">
                {t("admin.noAnalyticsData", "No analytics data available")}
              </div>
            </div>
          )}
    </div>
  );
}