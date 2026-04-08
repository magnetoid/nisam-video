import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  Globe, 
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LocalizedCategory } from "@shared/schema";

export default function AdminCategories() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LocalizedCategory | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<LocalizedCategory[]>({
    queryKey: ["/api/categories"],
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/categories/regenerate", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: t("admin.categoriesRegenerated", "Categories regenerated"),
        description: t("admin.categoriesRegeneratedDesc", "AI has analyzed content and generated categories."),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToRegenerateCategories", "Failed to regenerate categories"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/categories/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setDeleteId(null);
      toast({
        title: t("admin.categoryDeleted", "Category deleted"),
        description: t("admin.categoryDeletedDesc", "Category has been removed"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToDeleteCategory", "Failed to delete category"),
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCreateOpen(false);
      setFormData({ name: "", description: "" });
      toast({
        title: t("admin.categoryCreated", "Category created"),
        description: t("admin.categoryCreatedDesc", "Category has been created successfully"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToCreateCategory", "Failed to create category"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
      return apiRequest("PATCH", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditingCategory(null);
      setFormData({ name: "", description: "" });
      toast({
        title: t("admin.categoryUpdated", "Category updated"),
        description: t("admin.categoryUpdatedDesc", "Category has been updated successfully"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToUpdateCategory", "Failed to update category"),
        variant: "destructive",
      });
    },
  });

  const handleEdit = (category: LocalizedCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {t("admin.categoriesManagement", "Categories Management")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.categoriesManagementDesc", "Manage AI-generated and custom categories (Multilingual)")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {regenerateMutation.isPending ? t("admin.regenerating", "Regenerating...") : t("admin.regenerateMissing", "Regenerate Missing")}
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.createCategory", "Create Category")}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">{t("admin.allCategories", "All Categories")}</h2>
            <Badge variant="secondary" className="ml-2">
              {categories.length}
            </Badge>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">{t("admin.nameEN", "Name (EN)")}</TableHead>
                <TableHead className="min-w-[300px]">{t("admin.descriptionEN", "Description (EN)")}</TableHead>
                <TableHead>{t("admin.translations", "Translations")}</TableHead>
                <TableHead className="text-right">{t("common.videos", "Videos")}</TableHead>
                <TableHead className="text-right">{t("common.actions", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    {t("admin.loadingCategories", "Loading categories...")}
                  </TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">{t("admin.noCategories", "No categories yet")}</p>
                    <p className="text-sm mb-4">{t("admin.noCategoriesDesc", "Create categories manually or let AI generate them from video content")}</p>
                    <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
                      {t("admin.createFirstCategory", "Create First Category")}
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {category.description || <span className="italic opacity-50">{t("common.noDescription", "No description")}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {category.translations && category.translations.length > 0 ? (
                          category.translations.map((trans) => (
                            <Badge key={(trans as any).language || trans.languageCode} variant="outline" className="text-xs px-1.5 py-0 h-5">
                              {(trans as any).language || trans.languageCode}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {category.videoCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={isCreateOpen || !!editingCategory} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingCategory(null);
            setFormData({ name: "", description: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t("admin.editCategory", "Edit Category") : t("admin.createCategory", "Create Category")}
            </DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? t("admin.editCategoryDesc", "Update the category name and description.") 
                : t("admin.createCategoryDesc", "Add a new category to organize videos.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("admin.categoryName", "Name")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Technology"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("admin.categoryDescription", "Description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Category description..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsCreateOpen(false);
                setEditingCategory(null);
              }}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCategory ? t("common.update", "Update") : t("common.create", "Create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.deleteCategory", "Delete Category")}</DialogTitle>
            <DialogDescription>
              {t("admin.deleteCategoryConfirmation", "Are you sure you want to delete this category? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("common.deleting", "Deleting...") : t("common.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
