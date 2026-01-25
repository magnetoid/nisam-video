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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TvIcon,
  VideoIcon,
  FolderIcon,
  TagIcon,
  TrendingUp,
  Clock,
  Calendar,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import type {
  VideoWithRelations,
  Channel,
  Category,
  ActivityLog,
} from "@shared/schema";

interface DashboardStats {
  channels: number;
  videos: number;
  categories: number;
  tags: number;
  recentVideos: VideoWithRelations[];
  recentActivity: ActivityLog[];
  topChannels: Array<{ id: string; name: string; videoCount: number }>;
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard"],
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const { data: videos = [] } = useQuery<VideoWithRelations[]>({
    queryKey: ["/api/videos"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AdminSidebar />
        <main className="ml-60 pt-16 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading dashboard...</div>
          </div>
        </main>
      </div>
    );
  }

  const recentVideos = videos.slice(0, 5);
  const topChannels = channels
    .sort((a, b) => b.videoCount - a.videoCount)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />

      <main className="ml-60 pt-16 p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Overview of your content platform
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="stat-card-channels">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Channels
                </CardTitle>
                <TvIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold"
                  data-testid="text-total-channels"
                >
                  {channels.length}
                </div>
                <Link href="/admin/channels">
                  <a
                    className="text-xs text-primary hover:underline"
                    data-testid="link-view-channels"
                  >
                    View all channels →
                  </a>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="stat-card-videos">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Videos
                </CardTitle>
                <VideoIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold"
                  data-testid="text-total-videos"
                >
                  {videos.length}
                </div>
                <Link href="/admin/videos">
                  <a
                    className="text-xs text-primary hover:underline"
                    data-testid="link-view-videos"
                  >
                    Manage videos →
                  </a>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="stat-card-categories">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Categories
                </CardTitle>
                <FolderIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold"
                  data-testid="text-total-categories"
                >
                  {categories.length}
                </div>
                <Link href="/admin/categories">
                  <a
                    className="text-xs text-primary hover:underline"
                    data-testid="link-view-categories"
                  >
                    Manage categories →
                  </a>
                </Link>
              </CardContent>
            </Card>

            <Card data-testid="stat-card-analytics">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Analytics</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold"
                  data-testid="text-total-engagement"
                >
                  {videos.reduce(
                    (sum, v) => sum + v.likesCount + v.internalViewsCount,
                    0,
                  )}
                </div>
                <Link href="/admin/analytics">
                  <a
                    className="text-xs text-primary hover:underline"
                    data-testid="link-view-analytics"
                  >
                    View analytics →
                  </a>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Videos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Videos
                </CardTitle>
                <CardDescription>
                  Latest videos added to the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentVideos.length > 0 ? (
                  <div className="space-y-3">
                    {recentVideos.map((video) => (
                      <div
                        key={video.id}
                        className="flex items-start gap-3 p-2 rounded-md hover-elevate"
                        data-testid={`video-item-${video.id}`}
                      >
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-20 h-12 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {video.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {video.channel.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {video.likesCount} likes
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {video.internalViewsCount} views
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No videos yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Top Channels
                </CardTitle>
                <CardDescription>Channels with most videos</CardDescription>
              </CardHeader>
              <CardContent>
                {topChannels.length > 0 ? (
                  <div className="space-y-3">
                    {topChannels.map((channel, index) => (
                      <div
                        key={channel.id}
                        className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                        data-testid={`channel-item-${channel.id}`}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {channel.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {channel.videoCount} videos
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No channels yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Link href="/admin/channels">
                  <Button
                    className="w-full"
                    variant="outline"
                    data-testid="button-add-channel"
                  >
                    <TvIcon className="mr-2 h-4 w-4" />
                    Add Channel
                  </Button>
                </Link>
                <Link href="/admin/categories">
                  <Button
                    className="w-full"
                    variant="outline"
                    data-testid="button-create-category"
                  >
                    <FolderIcon className="mr-2 h-4 w-4" />
                    Create Category
                  </Button>
                </Link>
                <Link href="/admin/scheduler">
                  <Button
                    className="w-full"
                    variant="outline"
                    data-testid="button-manage-scheduler"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Manage Scheduler
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
