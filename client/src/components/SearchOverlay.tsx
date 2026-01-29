import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoCard } from "./VideoCard";
import type { VideoWithRelations, Category } from "@shared/schema";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSearch?: (query: string, categoryId?: string) => void;
  results?: VideoWithRelations[];
  categories?: Category[];
}

export function SearchOverlay({
  open,
  onClose,
  onSearch,
  results = [],
  categories = [],
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedCategory(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim() || selectedCategory) {
      onSearch?.(query, selectedCategory);
    }
  }, [query, selectedCategory, onSearch]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-background"
        data-testid="modal-search"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="sticky top-0 bg-background border-b border-border z-10">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search videos..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 pr-4 h-12 text-base"
                  autoFocus
                  data-testid="input-search"
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                data-testid="button-close-search"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={!selectedCategory ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1"
                  onClick={() => setSelectedCategory(undefined)}
                  data-testid="badge-category-all"
                >
                  All
                </Badge>
                {categories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={
                      selectedCategory === category.id ? "default" : "outline"
                    }
                    className="cursor-pointer px-3 py-1"
                    onClick={() => setSelectedCategory(category.id)}
                    data-testid={`badge-category-${category.id}`}
                  >
                    {category.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p
                className="text-lg text-muted-foreground"
                data-testid="text-no-results"
              >
                {query || selectedCategory
                  ? "No videos found"
                  : "Start typing to search videos"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
