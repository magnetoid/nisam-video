import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderTree, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Category, CategoryTranslation } from "@shared/schema";

type AdminCategory = Category & { translations: CategoryTranslation[] };

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "sr-Latn", label: "Serbian" },
];

export default function AdminCategories() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<AdminCategory | null>(
    null,
  );
  
  // State for form data per language
  const [formData, setFormData] = useState<Record<string, { name: string; description: string }>>({
    en: { name: "", description: "" },
    "sr-Latn": { name: "", description: "" },
  });

  const { data: categories = [], isLoading } = useQuery<AdminCategory[]>({
    queryKey: ["/api/admin/categories"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Category Created",
        description: "New category has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: any;
    }) => {
      // We need to send separate updates for each changed language
      // Or we could have a bulk update endpoint, but currently PUT /api/categories/:id updates one lang
      // We'll just update the current active language or all changed ones?
      // For simplicity, let's iterate and update.
      // But Promise.all might fail partially.
      // Ideally backend supports bulk update.
      // Let's assume we update each language sequentially for now.
      
      const promises = Object.entries(data).map(([lang, content]: [string, any]) => {
          if (!content.name) return Promise.resolve(); // Skip empty?
          return apiRequest("PUT", `/api/categories/${id}`, {
              languageCode: lang,
              name: content.name,
              description: content.description
          });
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      setEditingCategory(null);
      resetForm();
      toast({
        title: "Category Updated",
        description: "Category has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      setDeletingCategory(null);
      toast({
        title: "Category Deleted",
        description: "Category has been removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
      setFormData({
        en: { name: "", description: "" },
        "sr-Latn": { name: "", description: "" },
      });
  };

  const handleCreate = () => {
    // Construct translations array
    const translations = Object.entries(formData)
        .filter(([_, data]) => data.name.trim() !== "")
        .map(([lang, data]) => ({
            languageCode: lang,
            name: data.name,
            slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            description: data.description || null
        }));

    if (translations.length === 0) {
        toast({ title: "Error", description: "At least one language must have a name", variant: "destructive" });
        return;
    }

    createMutation.mutate({ translations });
  };

  const handleUpdate = () => {
    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory.id,
        data: formData,
      });
    }
  };

  const handleDelete = () => {
    if (deletingCategory) {
      deleteMutation.mutate(deletingCategory.id);
    }
  };

  const openEditDialog = (category: AdminCategory) => {
    setEditingCategory(category);
    
    const newFormData = {
        en: { name: "", description: "" },
        "sr-Latn": { name: "", description: "" },
    };
    
    category.translations.forEach(t => {
        if (newFormData[t.languageCode as keyof typeof newFormData]) {
            newFormData[t.languageCode as keyof typeof newFormData] = {
                name: t.name,
                description: t.description || ""
            };
        }
    });

    setFormData(newFormData);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };
  
  const updateFormData = (lang: string, field: 'name' | 'description', value: string) => {
      setFormData(prev => ({
          ...prev,
          [lang]: {
              ...prev[lang as keyof typeof prev],
              [field]: value
          }
      }));
  };

  // Helper to get English name or first available
  const getDisplayName = (category: AdminCategory) => {
      const en = category.translations.find(t => t.languageCode === 'en');
      if (en) return en.name;
      return category.translations[0]?.name || 'Unnamed';
  };
  
  const getDisplayDescription = (category: AdminCategory) => {
      const en = category.translations.find(t => t.languageCode === 'en');
      if (en) return en.description;
      return category.translations[0]?.description || '';
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 p-8 ml-[240px] pt-16">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                Categories Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage AI-generated and custom categories (Multilingual)
              </p>
            </div>
            <Button
              onClick={openCreateDialog}
              className="gap-2"
              data-testid="button-create-category"
            >
              <Plus className="h-4 w-4" />
              Create Category
            </Button>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading categories...</p>
              </CardContent>
            </Card>
          ) : categories.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3
                  className="text-lg font-semibold mb-2"
                  data-testid="text-empty-state"
                >
                  No categories yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create categories manually or let AI generate them from video
                  content
                </p>
                <Button onClick={openCreateDialog} variant="outline">
                  Create First Category
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>All Categories</CardTitle>
                <CardDescription>
                  {categories.length} total categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name (EN)</TableHead>
                      <TableHead>Description (EN)</TableHead>
                      <TableHead className="text-center">Translations</TableHead>
                      <TableHead className="text-center">Videos</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow
                        key={category.id}
                        data-testid={`row-category-${category.id}`}
                      >
                        <TableCell
                          className="font-medium"
                          data-testid="text-category-name"
                        >
                          {getDisplayName(category)}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-md">
                          {getDisplayDescription(category) || (
                            <span className="italic">No description</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                            <div className="flex gap-1 justify-center">
                                {category.translations.map(t => (
                                    <Badge key={t.languageCode} variant="outline" className="text-xs">
                                        {t.languageCode}
                                    </Badge>
                                ))}
                            </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            data-testid="badge-video-count"
                          >
                            {category.videoCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(category)}
                              data-testid={`button-edit-${category.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingCategory(category)}
                              data-testid={`button-delete-${category.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || !!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingCategory(null);
            resetForm();
          }
        }}
      >
        <DialogContent data-testid="dialog-category-form" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Create Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category name and description for each language"
                : "Add a new category with multilingual support"}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="en" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                {LANGUAGES.map(lang => (
                    <TabsTrigger key={lang.code} value={lang.code}>
                        {lang.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            
            {LANGUAGES.map(lang => (
                <TabsContent key={lang.code} value={lang.code} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${lang.code}`}>Category Name ({lang.label})</Label>
                      <Input
                        id={`name-${lang.code}`}
                        value={formData[lang.code]?.name || ''}
                        onChange={(e) => updateFormData(lang.code, 'name', e.target.value)}
                        placeholder={`e.g. ${lang.code === 'en' ? 'Technology' : 'Tehnologija'}`}
                        data-testid={`input-category-name-${lang.code}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`description-${lang.code}`}>Description ({lang.label})</Label>
                      <Textarea
                        id={`description-${lang.code}`}
                        value={formData[lang.code]?.description || ''}
                        onChange={(e) => updateFormData(lang.code, 'description', e.target.value)}
                        placeholder={`Description in ${lang.label}...`}
                        rows={3}
                        data-testid={`input-category-description-${lang.code}`}
                      />
                    </div>
                </TabsContent>
            ))}
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingCategory(null);
                resetForm();
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={editingCategory ? handleUpdate : handleCreate}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending
              }
              data-testid="button-save"
            >
              {editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingCategory}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory && getDisplayName(deletingCategory)}"? This
              action cannot be undone. Videos in this category will not be
              deleted, but the category association will be removed.
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
