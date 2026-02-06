import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagIcon, Search, Trash2, TrendingUp, Sparkles, Upload, ImageIcon, X, Loader2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TagImage } from "@shared/schema";

interface TagWithCount {
  tagName: string;
  count: number;
  videoIds: string[];
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "sr-Latn", label: "Serbian" },
];

export default function AdminTags() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  
  // Translation state
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [translationData, setTranslationData] = useState<Record<string, string>>({
      "sr-Latn": ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: tagsData = [], isLoading } = useQuery<TagWithCount[]>({
    queryKey: ["/api/tags/stats"],
  });

  const { data: tagImages = [] } = useQuery<TagImage[]>({
    queryKey: ["/api/tag-images"],
  });

  const tagImageMap = tagImages.reduce((acc, img) => {
    acc[img.tagName] = img;
    return acc;
  }, {} as Record<string, TagImage>);

  const deleteMutation = useMutation({
    mutationFn: async (tagName: string) => {
      return await apiRequest(
        "DELETE",
        `/api/tags/${encodeURIComponent(tagName)}`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      setDeletingTag(null);
      toast({
        title: "Tag Deleted",
        description: "Tag has been removed from all videos",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete tag",
        variant: "destructive",
      });
    },
  });
  
  const translateMutation = useMutation({
      mutationFn: async ({ tagName, lang, translation }: { tagName: string, lang: string, translation: string }) => {
          return await apiRequest(
              "PUT",
              `/api/admin/tags/${encodeURIComponent(tagName)}/translate`,
              { languageCode: lang, translation }
          );
      },
      onSuccess: () => {
          toast({
              title: "Tag Translated",
              description: "Translation updated successfully"
          });
      },
      onError: () => {
          toast({
              title: "Error",
              description: "Failed to update translation",
              variant: "destructive"
          });
      }
  });

  const handleTranslate = async () => {
      if (!editingTag) return;
      
      // Save for Serbian (and potentially others in future)
      if (translationData["sr-Latn"]?.trim()) {
          await translateMutation.mutateAsync({
              tagName: editingTag,
              lang: "sr-Latn",
              translation: translationData["sr-Latn"]
          });
      }
      
      setEditingTag(null);
      setTranslationData({ "sr-Latn": "" });
  };

  const openTranslateDialog = (tagName: string) => {
      setEditingTag(tagName);
      // Ideally fetch existing translation here if available
      // For now starting empty or we need an endpoint to get translations for a tagName
      setTranslationData({ "sr-Latn": "" });
  };

  const generateImageMutation = useMutation({
    mutationFn: async (tagName: string) => {
      setGeneratingImage(tagName);
      return await apiRequest(
        "POST",
        `/api/admin/tags/${encodeURIComponent(tagName)}/generate-image`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tag-images"] });
      setGeneratingImage(null);
      toast({
        title: "Image Generated",
        description: "AI-generated image has been created for this tag",
      });
    },
    onError: () => {
      setGeneratingImage(null);
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ tagName, imageUrl }: { tagName: string; imageUrl: string }) => {
      return await apiRequest(
        "POST",
        `/api/admin/tags/${encodeURIComponent(tagName)}/image`,
        { imageUrl },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tag-images"] });
      setUploadingImage(null);
      toast({
        title: "Image Uploaded",
        description: "Custom image has been set for this tag",
      });
    },
    onError: () => {
      setUploadingImage(null);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (tagName: string) => {
      return await apiRequest(
        "DELETE",
        `/api/admin/tags/${encodeURIComponent(tagName)}/image`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tag-images"] });
      toast({
        title: "Image Removed",
        description: "Tag image has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove image",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (deletingTag) {
      deleteMutation.mutate(deletingTag);
    }
  };

  const handleFileSelect = async (tagName: string, file: File) => {
    setUploadingImage(tagName);
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL } = await response.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      uploadImageMutation.mutate({ tagName, imageUrl: uploadURL });
    } catch (error) {
      setUploadingImage(null);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const filteredTags = tagsData.filter((tag) =>
    tag.tagName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const sortedTags = [...filteredTags].sort((a, b) => b.count - a.count);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />

      <main className="ml-60 pt-16 p-8">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="text-3xl font-bold flex items-center gap-2"
                data-testid="text-page-title"
              >
                <TagIcon className="h-8 w-8" />
                Tags Management
              </h1>
              <p className="text-muted-foreground mt-1">
                View and manage video tags and their images
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tags
                </CardTitle>
                <TagIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold"
                  data-testid="text-total-tags"
                >
                  {tagsData.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tagged Videos
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold"
                  data-testid="text-tagged-videos"
                >
                  {tagsData.reduce((sum, tag) => sum + tag.count, 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Tags/Video
                </CardTitle>
                <TagIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-tags">
                  {tagsData.length > 0
                    ? (
                        tagsData.reduce((sum, tag) => sum + tag.count, 0) /
                        tagsData.length
                      ).toFixed(1)
                    : 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tags with Images
                </CardTitle>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-tags-with-images">
                  {tagImages.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tags Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Tags</CardTitle>
              <CardDescription>
                Browse and manage all video tags. Generate AI images or upload custom images for tags.
              </CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-tags"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading tags...
                </div>
              ) : sortedTags.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Image</TableHead>
                      <TableHead>Tag Name</TableHead>
                      <TableHead className="text-center">Video Count</TableHead>
                      <TableHead className="text-center">Popularity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTags.map((tag) => {
                      const tagImage = tagImageMap[tag.tagName];
                      const isGenerating = generatingImage === tag.tagName;
                      const isUploading = uploadingImage === tag.tagName;

                      return (
                        <TableRow
                          key={tag.tagName}
                          data-testid={`tag-row-${tag.tagName}`}
                        >
                          <TableCell>
                            {tagImage ? (
                              <div className="relative w-12 h-8 rounded overflow-hidden">
                                <img
                                  src={tagImage.imageUrl}
                                  alt={tag.tagName}
                                  className="w-full h-full object-cover"
                                />
                                {tagImage.isAiGenerated === 1 && (
                                  <div className="absolute bottom-0 right-0 bg-primary/80 p-0.5 rounded-tl">
                                    <Sparkles className="h-2 w-2 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-12 h-8 rounded bg-muted flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <Badge variant="outline" className="text-sm">
                              {tag.tagName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{tag.count}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {tag.count > 10 && (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              )}
                              {tag.count >= 5 && tag.count <= 10 && (
                                <TrendingUp className="h-4 w-4 text-yellow-500" />
                              )}
                              {tag.count < 5 && (
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openTranslateDialog(tag.tagName)}
                                title="Translate Tag"
                                data-testid={`button-translate-${tag.tagName}`}
                              >
                                <Globe className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => generateImageMutation.mutate(tag.tagName)}
                                disabled={isGenerating || isUploading}
                                title="Generate AI Image"
                                data-testid={`button-generate-image-${tag.tagName}`}
                              >
                                {isGenerating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 text-primary" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      handleFileSelect(tag.tagName, file);
                                    }
                                  };
                                  input.click();
                                }}
                                disabled={isGenerating || isUploading}
                                title="Upload Custom Image"
                                data-testid={`button-upload-image-${tag.tagName}`}
                              >
                                {isUploading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4 text-blue-500" />
                                )}
                              </Button>
                              {tagImage && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteImageMutation.mutate(tag.tagName)}
                                  title="Remove Image"
                                  data-testid={`button-remove-image-${tag.tagName}`}
                                >
                                  <X className="h-4 w-4 text-orange-500" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingTag(tag.tagName)}
                                data-testid={`button-delete-${tag.tagName}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "No tags match your search"
                    : "No tags available"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Translate Dialog */}
      <Dialog
        open={!!editingTag}
        onOpenChange={(open) => {
            if (!open) {
                setEditingTag(null);
                setTranslationData({ "sr-Latn": "" });
            }
        }}
      >
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Translate Tag</DialogTitle>
                <DialogDescription>
                    Add translations for "{editingTag}".
                </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="sr-Latn" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="en">English (Original)</TabsTrigger>
                    <TabsTrigger value="sr-Latn">Serbian</TabsTrigger>
                </TabsList>
                <TabsContent value="en" className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tag Name (English)</Label>
                        <Input value={editingTag || ''} disabled />
                        <p className="text-xs text-muted-foreground">Original tag name is read-only here.</p>
                    </div>
                </TabsContent>
                <TabsContent value="sr-Latn" className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tag Name (Serbian)</Label>
                        <Input 
                            value={translationData["sr-Latn"]} 
                            onChange={(e) => setTranslationData({ ...translationData, "sr-Latn": e.target.value })}
                            placeholder="Muzika..." 
                        />
                    </div>
                </TabsContent>
            </Tabs>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingTag(null)}>Cancel</Button>
                <Button onClick={handleTranslate}>Save Translation</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingTag}
        onOpenChange={(open) => !open && setDeletingTag(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{deletingTag}"? This will
              remove it from all videos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}