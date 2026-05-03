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

interface Rule {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  isActive: boolean;
}

export default function AdminRules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ["/api/system-rules-skills/rules"],
  });

  const mutation = useMutation({
    mutationFn: async (rule: Partial<Rule>) => {
      const isEdit = !!rule.id;
      const url = isEdit ? `/api/system-rules-skills/rules/${rule.id}` : "/api/system-rules-skills/rules";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-rules-skills/rules"] });
      setIsDialogOpen(false);
      setEditingRule(null);
      toast({ title: "Success", description: "Rule saved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/system-rules-skills/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-rules-skills/rules"] });
      toast({ title: "Success", description: "Rule deleted successfully." });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    mutation.mutate({
      id: editingRule?.id,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      content: formData.get("content") as string,
      category: formData.get("category") as string,
    });
  };

  const filteredRules = rules.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Rules</h1>
          <p className="text-muted-foreground mt-1">Manage AI behavior and system rules</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingRule(null);
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
              <DialogDescription>Define system behavior using Markdown.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" defaultValue={editingRule?.title} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" defaultValue={editingRule?.category || "general"} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Short Description</Label>
                <Input id="description" name="description" defaultValue={editingRule?.description} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Content (Markdown)</Label>
                  <Textarea 
                    id="content" 
                    name="content" 
                    className="min-h-[400px] font-mono text-sm" 
                    defaultValue={editingRule?.content} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded-md p-4 min-h-[400px] prose dark:prose-invert max-w-none overflow-y-auto bg-muted/50">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {editingRule?.content || "*Preview will appear here...*"}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : "Save Rule"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2">
        <Input 
          placeholder="Search rules..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading rules...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRules.map(rule => (
            <Card key={rule.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{rule.title}</CardTitle>
                    <CardDescription className="mt-1">{rule.category}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditingRule(rule);
                      setIsDialogOpen(true);
                    }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm("Are you sure you want to delete this rule?")) {
                        deleteMutation.mutate(rule.id);
                      }
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground mb-4">{rule.description}</p>
                <div className="prose dark:prose-invert prose-sm max-w-none line-clamp-4 bg-muted/30 p-3 rounded-md border">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{rule.content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredRules.length === 0 && (
            <div className="col-span-full text-center py-10 text-muted-foreground border rounded-lg border-dashed">
              No rules found matching your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
