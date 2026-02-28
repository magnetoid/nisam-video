import { useState, useMemo } from "react";
import { Plus, RefreshCw, Trash2, ExternalLink, Youtube, Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { AddChannelDialog } from "./AddChannelDialog";
import type { Channel } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface ChannelManagementProps {
  channels: Channel[];
  onAdd?: (url: string, name: string) => void;
  onScrape?: (channelId: string) => void;
  onDelete?: (channelId: string) => void;
  isLoading?: boolean;
}

type SortField = "name" | "videoCount" | "lastScraped";
type SortOrder = "asc" | "desc";

export function ChannelManagement({
  channels,
  onAdd,
  onScrape,
  onDelete,
  isLoading = false,
}: ChannelManagementProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("lastScraped");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const filteredAndSortedChannels = useMemo(() => {
    let result = [...channels];

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.url && c.url.toLowerCase().includes(q))
      );
    }

    // Filter by platform
    if (platformFilter !== "all") {
      result = result.filter((c) => c.platform === platformFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "lastScraped") {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [channels, search, platformFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc"); // Default to desc for new field
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Channel Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Add and manage YouTube channels for video aggregation
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          data-testid="button-add-channel"
          className="gap-2"
        >
          <Plus className="h-5 w-5" />
          Add Channel
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filteredAndSortedChannels.length} channels</span>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Youtube className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3
            className="text-lg font-semibold mb-2"
            data-testid="text-empty-state"
          >
            No channels added yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Add your first YouTube channel to start aggregating videos
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            data-testid="button-add-first-channel"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Channel
          </Button>
        </div>
      ) : filteredAndSortedChannels.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
              No channels found matching your filters.
          </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px] cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("name")}>
                    <div className="flex items-center gap-1">
                      Channel <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("videoCount")}>
                    <div className="flex items-center gap-1">
                      Videos <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("lastScraped")}>
                    <div className="flex items-center gap-1">
                      Last Scraped <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedChannels.map((channel) => (
                  <TableRow
                    key={channel.id}
                    data-testid={`row-channel-${channel.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {channel.thumbnailUrl ? (
                          <img
                            src={channel.thumbnailUrl}
                            alt={channel.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold">{channel.name.substring(0, 2).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div
                            className="font-medium flex items-center gap-2 truncate"
                            data-testid="text-channel-name"
                          >
                            <span className="truncate">{channel.name}</span>
                            {channel.platform === 'tiktok' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">TikTok</Badge>
                            )}
                          </div>
                          <a
                            href={channel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                            data-testid="link-channel-url"
                          >
                            View on {channel.platform === 'tiktok' ? 'TikTok' : 'YouTube'}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid="badge-video-count">
                        {channel.videoCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-sm text-muted-foreground whitespace-nowrap"
                        data-testid="text-last-scraped"
                      >
                        {channel.lastScraped
                          ? formatDistanceToNow(new Date(channel.lastScraped), { addSuffix: true })
                          : "Never"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onScrape?.(channel.id)}
                          disabled={isLoading}
                          data-testid={`button-scrape-${channel.id}`}
                          className="gap-2"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                          />
                          <span className="hidden sm:inline">Scrape</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDelete?.(channel.id)}
                          data-testid={`button-delete-${channel.id}`}
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
        </div>
      )}

      <AddChannelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={onAdd}
      />
    </div>
  );
}
