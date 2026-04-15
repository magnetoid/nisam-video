import {
  MoreVertical,
  Play,
  Trash2,
  FolderPlus,
  Tag as TagIcon,
  Filter,
  Check,
  Search,
  Loader2,
  ListVideo,
  Eye,
  Edit,
  BrainCircuit,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import type {
  VideoWithRelations,
  Channel,
  LocalizedCategory,
  Playlist,
} from "@shared/schema";

interface VideoManagementProps {
  videos: VideoWithRelations[];
  channels?: Channel[];
  categories?: LocalizedCategory[];
  playlists?: Playlist[];
  selectedVideoIds: string[];
  selectedChannelId?: string;
  selectedCategoryId?: string;
  page?: number;
  pageSize?: number;
  hasNextPage?: boolean;
  isLoading?: boolean;
  onView?: (video: VideoWithRelations) => void;
  onEdit?: (video: VideoWithRelations) => void;
  onCategorize?: (videoId: string) => void;
  onDelete?: (videoId: string) => void;
  onAddToPlaylist?: (videoId: string, playlistId: string) => void;
  onToggleSelect?: (videoId: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onBulkCategorize?: () => void;
  onBulkTag?: (tags: string[]) => void;
  onBulkDelete?: () => void;
  onCategorizeMissing?: () => void;
  onChannelFilterChange?: (channelId: string | undefined) => void;
  onCategoryFilterChange?: (categoryId: string | undefined) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  processingVideoIds?: Set<string>;
  isBulkProcessing?: boolean;
  isCategorizeMissingProcessing?: boolean;
}

export function VideoManagement({
  videos,
  channels = [],
  categories = [],
  playlists = [],
  selectedVideoIds,
  selectedChannelId,
  selectedCategoryId,
  page = 1,
  pageSize = 50,
  hasNextPage = false,
  isLoading = false,
  onView,
  onEdit,
  onCategorize,
  onDelete,
  onAddToPlaylist,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onBulkCategorize,
  onBulkTag,
  onBulkDelete,
  onCategorizeMissing,
  onChannelFilterChange,
  onCategoryFilterChange,
  onPageChange,
  onPageSizeChange,
  processingVideoIds = new Set(),
  isBulkProcessing = false,
  isCategorizeMissingProcessing = false,
}: VideoManagementProps) {
  const { t } = useTranslation();
  const allSelected =
    videos.length > 0 && selectedVideoIds.length === videos.length;
  const someSelected =
    selectedVideoIds.length > 0 && selectedVideoIds.length < videos.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {t("admin.videoManagement", "Video Management")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.manageVideosDesc", "Manage and categorize aggregated videos")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {onCategorizeMissing && (
          <Button
            size="sm"
            variant="outline"
            onClick={onCategorizeMissing}
            disabled={isCategorizeMissingProcessing}
            data-testid="button-ai-categorize-missing"
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {isCategorizeMissingProcessing ? t("common.processing", "Processing...") : t("admin.categorizeMissing", "AI Categorize Missing")}
          </Button>
        )}

        {selectedVideoIds.length > 0 && (
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedVideoIds.length} {t("common.selected", "selected")}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={onBulkCategorize}
              disabled={isBulkProcessing}
              data-testid="button-bulk-categorize"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {t("admin.bulkCategorize", "Bulk AI Categorize")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const tags = prompt(t("admin.enterTagsPrompt", "Enter tags separated by commas:"));
                if (tags && tags.trim()) {
                  const tagArray = tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t);
                  if (tagArray.length > 0) {
                    onBulkTag?.(tagArray);
                  }
                }
              }}
              disabled={isBulkProcessing}
              data-testid="button-bulk-tag"
            >
              {t("admin.bulkAddTags", "Bulk Add Tags")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onBulkDelete}
              disabled={isBulkProcessing}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("admin.bulkDelete", "Bulk Delete")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDeselectAll}
              data-testid="button-deselect-all"
            >
              {t("common.clearSelection", "Clear Selection")}
            </Button>
          </div>
        )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <Select
          value={selectedChannelId || "all"}
          onValueChange={(value) =>
            onChannelFilterChange?.(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger
            className="w-[200px]"
            data-testid="select-channel-filter"
          >
            <SelectValue placeholder={t("admin.allChannels", "All Channels")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.allChannels", "All Channels")}</SelectItem>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedCategoryId || "all"}
          onValueChange={(value) =>
            onCategoryFilterChange?.(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger
            className="w-[200px]"
            data-testid="select-category-filter"
          >
            <SelectValue placeholder={t("admin.allCategories", "All Categories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.allCategories", "All Categories")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(selectedChannelId || selectedCategoryId) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onChannelFilterChange?.(undefined);
              onCategoryFilterChange?.(undefined);
            }}
            data-testid="button-clear-filters"
          >
            {t("common.clearFilters", "Clear Filters")}
          </Button>
        )}
      </div>

      {isLoading && videos.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">{t("common.loading", "Loading...")}</h3>
          <p className="text-muted-foreground">{t("admin.fetchingVideos", "Fetching videos")}</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3
            className="text-lg font-semibold mb-2"
            data-testid="text-empty-state"
          >
            {t("admin.noVideosFound", "No videos found")}
          </h3>
          <p className="text-muted-foreground">
            {t("admin.addChannelsTip", "Add channels and scrape them to aggregate videos")}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() =>
                      allSelected ? onDeselectAll?.() : onSelectAll?.()
                    }
                    data-testid="checkbox-select-all"
                    aria-label={t("admin.selectAllVideos", "Select all videos")}
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">{t("admin.video", "Video")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("admin.channel", "Channel")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("admin.categories", "Categories")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("admin.tags", "Tags")}</TableHead>
                <TableHead className="text-right">{t("common.actions", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((video) => (
                <TableRow key={video.id} data-testid={`row-video-${video.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedVideoIds.includes(video.id)}
                      onCheckedChange={() => onToggleSelect?.(video.id)}
                      data-testid={`checkbox-select-${video.id}`}
                      aria-label={`${t("common.select", "Select")} ${video.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-20 h-12 object-cover rounded"
                      />
                      <div className="min-w-0">
                        <div
                          className="font-medium line-clamp-2 text-sm"
                          data-testid="text-video-title"
                        >
                          {video.title}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm" data-testid="text-channel-name">
                      {video.channel.name}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {video.categories && video.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {video.categories.slice(0, 2).map((cat) => (
                          <Badge
                            key={cat.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {cat.name}
                          </Badge>
                        ))}
                        {video.categories.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{video.categories.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("admin.noCategories", "No categories")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {video.tags && video.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {video.tags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag.tagName}
                          </Badge>
                        ))}
                        {video.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{video.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("admin.noTags", "No tags")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onView?.(video)}
                        data-testid={`button-view-${video.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit?.(video)}
                        data-testid={`button-edit-${video.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCategorize?.(video.id)}
                        disabled={processingVideoIds.has(video.id)}
                        data-testid={`button-categorize-${video.id}`}
                        className="gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        {processingVideoIds.has(video.id)
                          ? t("common.processing", "Processing...")
                          : "AI"}
                      </Button>
                      {onAddToPlaylist && playlists && playlists.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-add-to-playlist-${video.id}`}
                              className="gap-2"
                            >
                              <ListVideo className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {playlists.map((playlist) => (
                              <DropdownMenuItem
                                key={playlist.id}
                                onClick={() =>
                                  onAddToPlaylist(video.id, playlist.id)
                                }
                                data-testid={`menu-item-add-${video.id}-${playlist.id}`}
                              >
                                {playlist.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDelete?.(video.id)}
                        data-testid={`button-delete-${video.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("common.page", "Page")}</span>
              <span className="text-sm font-medium">{page}</span>
              {isLoading && (
                <span className="text-sm text-muted-foreground">{t("common.loading", "Loading...")}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => onPageSizeChange?.(parseInt(value, 10))}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 / {t("common.page", "page")}</SelectItem>
                  <SelectItem value="50">50 / {t("common.page", "page")}</SelectItem>
                  <SelectItem value="100">100 / {t("common.page", "page")}</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange?.(Math.max(1, page - 1))}
                disabled={isLoading || page <= 1}
              >
                {t("common.previous", "Previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange?.(page + 1)}
                disabled={isLoading || !hasNextPage}
              >
                {t("common.next", "Next")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
