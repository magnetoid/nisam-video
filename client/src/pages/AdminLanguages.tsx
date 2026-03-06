import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Save, Globe, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface SupportedLanguage {
  code: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

interface UiTranslation {
  key: string;
  value: string;
}

export default function AdminLanguages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLang, setEditingLang] = useState<SupportedLanguage | null>(null);
  const [selectedLangCode, setSelectedLangCode] = useState<string>("en");

  // Fetch Languages
  const { data: languages = [], isLoading: isLoadingLangs } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
  });

  // Fetch Translations for selected language
  const { data: translations = {}, isLoading: isLoadingTrans } = useQuery<Record<string, string>>({
    queryKey: ["/api/translations", selectedLangCode],
    enabled: !!selectedLangCode,
  });

  // Fetch English translations as template
  const { data: enTranslations = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/translations", "en"],
    enabled: selectedLangCode !== "en",
  });

  // Mutations
  const upsertLangMutation = useMutation({
    mutationFn: async (data: Partial<SupportedLanguage>) => {
      const res = await apiRequest("POST", "/api/languages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/languages"] });
      setIsAddOpen(false);
      setEditingLang(null);
      toast({ title: "Success", description: "Language saved successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to save language", variant: "destructive" });
    },
  });

  const deleteLangMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("DELETE", `/api/languages/${code}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/languages"] });
      toast({ title: "Success", description: "Language deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Cannot delete default language", variant: "destructive" });
    },
  });

  const saveTranslationMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest("POST", "/api/translations", {
        languageCode: selectedLangCode,
        key,
        value,
        namespace: "translation",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/translations", selectedLangCode] });
      toast({ title: "Saved", description: "Translation updated" });
    },
  });

  const autoTranslateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/translate", {
        targetLang: selectedLangCode,
        sourceLang: "en"
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/translations", selectedLangCode] });
      toast({ 
        title: "Translation Complete", 
        description: data.message 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Translation Failed", 
        description: error.message || "Failed to auto-translate", 
        variant: "destructive" 
      });
    },
  });

  // Form State
  const [formData, setFormData] = useState<Partial<SupportedLanguage>>({
    code: "",
    name: "",
    isActive: true,
    isDefault: false,
  });

  const handleEdit = (lang: SupportedLanguage) => {
    setFormData(lang);
    setEditingLang(lang);
    setIsAddOpen(true);
  };

  const handleAdd = () => {
    setFormData({ code: "", name: "", isActive: true, isDefault: false });
    setEditingLang(null);
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertLangMutation.mutate(formData);
  };

  // Translation Editor Logic
  // Flatten English keys to show as list
  const translationKeys = selectedLangCode === "en" 
    ? Object.keys(translations).sort()
    : Array.from(new Set([...Object.keys(enTranslations), ...Object.keys(translations)])).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Languages & Localization</h1>
          <p className="text-muted-foreground">Manage supported languages and translations</p>
        </div>
      </div>

      <Tabs defaultValue="languages" className="w-full">
        <TabsList>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="translations">Translations</TabsTrigger>
        </TabsList>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Supported Languages</CardTitle>
                <CardDescription>
                  Languages available in the language switcher
                </CardDescription>
              </div>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAdd}>
                    <Plus className="mr-2 h-4 w-4" /> Add Language
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingLang ? "Edit Language" : "Add Language"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Language Code (ISO 639-1)</Label>
                      <Input 
                        placeholder="e.g. fr, de, es" 
                        value={formData.code} 
                        onChange={e => setFormData({...formData, code: e.target.value})}
                        disabled={!!editingLang} // Code is PK
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Display Name</Label>
                      <Input 
                        placeholder="e.g. Français" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="isActive" 
                          checked={formData.isActive} 
                          onCheckedChange={(c) => setFormData({...formData, isActive: c as boolean})}
                        />
                        <Label htmlFor="isActive">Active</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="isDefault" 
                          checked={formData.isDefault} 
                          onCheckedChange={(c) => setFormData({...formData, isDefault: c as boolean})}
                          disabled={editingLang?.isDefault}
                        />
                        <Label htmlFor="isDefault">
                          Primary Language
                          {editingLang?.isDefault && <span className="text-xs text-muted-foreground ml-2">(Cannot be unset directly)</span>}
                        </Label>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={upsertLangMutation.isPending}>
                      {upsertLangMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingLangs ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">Loading...</TableCell>
                    </TableRow>
                  ) : languages.map((lang) => (
                    <TableRow key={lang.code}>
                      <TableCell className="font-mono">{lang.code}</TableCell>
                      <TableCell>{lang.name}</TableCell>
                      <TableCell>
                        {lang.isDefault ? (
                          <Badge variant="default">Primary</Badge>
                        ) : (
                          <Badge variant="secondary">Secondary</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lang.isActive ? <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(lang)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              if (confirm(`Delete ${lang.name}?`)) deleteLangMutation.mutate(lang.code);
                            }}
                            disabled={lang.isDefault || lang.code === 'en'}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="translations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Translation Editor</CardTitle>
                  <CardDescription>Edit UI strings for each language</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => autoTranslateMutation.mutate()}
                    disabled={selectedLangCode === "en" || autoTranslateMutation.isPending}
                  >
                    {autoTranslateMutation.isPending ? (
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                       <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Auto Translate
                  </Button>
                  <Globe className="h-4 w-4 text-muted-foreground ml-2" />
                  <select 
                    className="h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedLangCode}
                    onChange={(e) => setSelectedLangCode(e.target.value)}
                  >
                    {languages.map(l => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTrans ? (
                <div className="text-center py-8">Loading translations...</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground border-b pb-2">
                    <div className="col-span-4">Key</div>
                    <div className="col-span-4">English (Reference)</div>
                    <div className="col-span-4">Translation</div>
                  </div>
                  {translationKeys.map((key) => (
                    <TranslationRow 
                      key={key} 
                      tKey={key} 
                      enValue={enTranslations[key] || translations[key]} 
                      currentValue={translations[key] || ""} 
                      onSave={(val) => saveTranslationMutation.mutate({ key, value: val })}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TranslationRow({ tKey, enValue, currentValue, onSave }: { tKey: string, enValue: string, currentValue: string, onSave: (val: string) => void }) {
  const [value, setValue] = useState(currentValue);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setValue(currentValue);
    }
  }, [currentValue, isDirty]);

  const handleBlur = () => {
    if (isDirty) {
      onSave(value);
      setIsDirty(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 items-center py-2 border-b last:border-0">
      <div className="col-span-4 font-mono text-xs truncate" title={tKey}>{tKey}</div>
      <div className="col-span-4 text-sm text-muted-foreground truncate" title={enValue}>{enValue}</div>
      <div className="col-span-4">
        <Input 
          value={value} 
          onChange={(e) => { setValue(e.target.value); setIsDirty(true); }}
          onBlur={handleBlur}
          className={isDirty ? "border-yellow-500" : ""}
          placeholder={enValue}
        />
      </div>
    </div>
  );
}
