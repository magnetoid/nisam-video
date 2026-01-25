import { Sparkles, Trash2, Eye, ListVideo, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  VideoWithRelations,
  Channel,
  Category,
  Playlist,
} from "@shared/schema";

interface VideoManagementProps {
  videos: VideoWithRelations[];
  channels?: Channel[];
  categories?: Category[];
  playlists?: Playlist[];
  selectedVideoIds: string[];
  selectedChannelId?: string;
  selectedCategoryId?: string;
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
  onChannelFilterChange?: (channelId: string | undefined) => void;
  onCategoryFilterChange?: (categoryId: string | undefined) => void;
  processingVideoIds?: Set<string>;
  isBulkProcessing?: boolean;
}

export function VideoManagement({
  videos,
  channels = [],
  categories = [],
  playlists = [],
  selectedVideoIds,
  selectedChannelId,
  selectedCategoryId,
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
  onChannelFilterChange,
  onCategoryFilterChange,
  processingVideoIds = new Set(),
  isBulkProcessing = false,
}: VideoManagementProps) {
  const allSelected =
    videos.length > 0 && selectedVideoIds.length === videos.length;
  const someSelected =
    selectedVideoIds.length > 0 && selectedVideoIds.length < videos.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Video Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and categorize aggregated videos
          </p>
        </div>

        {selectedVideoIds.length > 0 && (
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1.5">
              {selectedVideoIds.length} selected
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={onBulkCategorize}
              disabled={isBulkProcessing}
              data-testid="button-bulk-categorize"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Bulk AI Categorize
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const tags = prompt("Enter tags separated by commas:");
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
              Bulk Add Tags
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onBulkDelete}
              disabled={isBulkProcessing}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Bulk Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDeselectAll}
              data-testid="button-deselect-all"
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
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
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
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
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
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
            Clear Filters
          </Button>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3
            className="text-lg font-semibold mb-2"
            data-testid="text-empty-state"
          >
            No videos found
          </h3>
          <p className="text-muted-foreground">
            Add channels and scrape them to aggregate videos
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
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
                    aria-label="Select all videos"
                  />
                </TableHead>
                <TableHead className="w-[300px]">Video</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      aria-label={`Select ${video.title}`}
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
                  <TableCell>
                    <span className="text-sm" data-testid="text-channel-name">
                      {video.channel.name}
                    </span>
                  </TableCell>
                  <TableCell>
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
                        No categories
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
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
                        No tags
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
                          ? "Processing..."
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
      )}
    </div>
  );
}
