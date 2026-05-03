import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  isActive: boolean;
}

export default function AdminSkills() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: skills = [], isLoading } = useQuery<Skill[]>({
    queryKey: ["/api/system-rules-skills/skills"],
  });

  const mutation = useMutation({
    mutationFn: async (skill: Partial<Skill>) => {
      const isEdit = !!skill.id;
      const url = isEdit ? `/api/system-rules-skills/skills/${skill.id}` : "/api/system-rules-skills/skills";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skill),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-rules-skills/skills"] });
      setIsDialogOpen(false);
      setEditingSkill(null);
      toast({ title: "Success", description: "Skill saved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/system-rules-skills/skills/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-rules-skills/skills"] });
      toast({ title: "Success", description: "Skill deleted successfully." });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    mutation.mutate({
      id: editingSkill?.id,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      content: formData.get("content") as string,
      category: formData.get("category") as string,
    });
  };

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Skills</h1>
          <p className="text-muted-foreground mt-1">Manage AI skills and operational capabilities</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingSkill(null);
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Skill</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSkill ? "Edit Skill" : "Create New Skill"}</DialogTitle>
              <DialogDescription>Define system skills using Markdown.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Skill Name</Label>
                  <Input id="name" name="name" defaultValue={editingSkill?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" defaultValue={editingSkill?.category || "general"} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Short Description</Label>
                <Input id="description" name="description" defaultValue={editingSkill?.description} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Content (Markdown)</Label>
                  <Textarea 
                    id="content" 
                    name="content" 
                    className="min-h-[400px] font-mono text-sm" 
                    defaultValue={editingSkill?.content} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded-md p-4 min-h-[400px] prose dark:prose-invert max-w-none overflow-y-auto bg-muted/50">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {editingSkill?.content || "*Preview will appear here...*"}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : "Save Skill"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Input 
          placeholder="Search skills..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading skills...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSkills.map(skill => (
            <Card key={skill.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{skill.name}</CardTitle>
                    <CardDescription className="mt-1">{skill.category}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditingSkill(skill);
                      setIsDialogOpen(true);
                    }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm("Are you sure you want to delete this skill?")) {
                        deleteMutation.mutate(skill.id);
                      }
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground mb-4">{skill.description}</p>
                <div className="prose dark:prose-invert prose-sm max-w-none line-clamp-4 bg-muted/30 p-3 rounded-md border">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{skill.content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredSkills.length === 0 && (
            <div className="col-span-full text-center py-10 text-muted-foreground border rounded-lg border-dashed">
              No skills found matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
