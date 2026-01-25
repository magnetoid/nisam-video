import { useState } from "react";
import { Plus, RefreshCw, Trash2, ExternalLink, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ChannelManagementProps {
  channels: Channel[];
  onAdd?: (url: string, name: string) => void;
  onScrape?: (channelId: string) => void;
  onDelete?: (channelId: string) => void;
  isLoading?: boolean;
}

export function ChannelManagement({
  channels,
  onAdd,
  onScrape,
  onDelete,
  isLoading = false,
}: ChannelManagementProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Videos</TableHead>
                <TableHead>Last Scraped</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((channel) => (
                <TableRow
                  key={channel.id}
                  data-testid={`row-channel-${channel.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {channel.thumbnailUrl && (
                        <img
                          src={channel.thumbnailUrl}
                          alt={channel.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div
                          className="font-medium"
                          data-testid="text-channel-name"
                        >
                          {channel.name}
                        </div>
                        <a
                          href={channel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                          data-testid="link-channel-url"
                        >
                          View on YouTube
                          <ExternalLink className="h-3 w-3" />
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
                      className="text-sm text-muted-foreground"
                      data-testid="text-last-scraped"
                    >
                      {channel.lastScraped
                        ? new Date(channel.lastScraped).toLocaleDateString()
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
                        Scrape
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
      )}

      <AddChannelDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={onAdd}
      />
    </div>
  );
}
