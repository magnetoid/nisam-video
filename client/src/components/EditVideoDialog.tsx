import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VideoWithRelations, Category } from "@shared/schema";

interface EditVideoDialogProps {
  video: VideoWithRelations | null;
  categories: Category[];
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    categoryIds: string[];
    tags: string[];
  }) => void;
  isSaving?: boolean;
}

export function EditVideoDialog({
  video,
  categories,
  open,
  onClose,
  onSave,
  isSaving = false,
}: EditVideoDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    if (video && open) {
      setTitle(video.title);
      setDescription(video.description || "");
      setSelectedCategories(video.categories?.map((c) => c.id) || []);
      setTagsInput(video.tags?.map((t) => t.tagName).join(", ") || "");
    }
  }, [video, open]);

  const handleSave = () => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSave({
      title,
      description,
      categoryIds: selectedCategories,
      tags,
    });
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-edit-video">
        <DialogHeader>
          <DialogTitle>Edit Video</DialogTitle>
          <DialogDescription>
            Update video title, description, categories, and tags
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-start gap-4">
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-32 h-20 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {video.channel.name}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title..."
              data-testid="input-video-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter video description..."
              rows={4}
              data-testid="input-video-description"
            />
          </div>

          <div className="space-y-3">
            <Label>Categories</Label>
            <ScrollArea className="h-40 border border-border rounded-md p-3">
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                      data-testid={`checkbox-category-${category.id}`}
                    />
                    <label
                      htmlFor={`category-${category.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {category.name}
                    </label>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No categories available
                  </p>
                )}
              </div>
            </ScrollArea>
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {categories
                  .filter((c) => selectedCategories.includes(c.id))
                  .map((cat) => (
                    <Badge key={cat.id} variant="outline" className="text-xs">
                      {cat.name}
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., technology, science, education"
              data-testid="input-video-tags"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple tags with commas
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            data-testid="button-cancel-edit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-video"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
