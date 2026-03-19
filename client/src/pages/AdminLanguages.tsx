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
import { useTranslation } from "react-i18next";

import type { SupportedLanguageLite } from "@/types/languages";

interface UiTranslation {
  key: string;
  value: string;
}

export default function AdminLanguages() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLang, setEditingLang] = useState<SupportedLanguageLite | null>(null);
  const [selectedLangCode, setSelectedLangCode] = useState<string>("sr-Latn");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  // Fetch Languages
  const { data: languages = [], isLoading: isLoadingLangs } = useQuery<SupportedLanguageLite[]>({
    queryKey: ["/api/languages"],
  });

  useEffect(() => {
    if (!languages.length) return;
    const primary = languages.find((l) => l.isDefault)?.code;
    if (!primary) return;
    setSelectedLangCode((prev) => {
      if (!prev) return primary;
      const exists = languages.some((l) => l.code === prev);
      return exists ? prev : primary;
    });
  }, [languages]);

  // Fetch Translations for selected language
  const { data: translations = {}, isLoading: isLoadingTrans } = useQuery<Record<string, string>>({
    queryKey: ["/api/translations", selectedLangCode],
    enabled: !!selectedLangCode,
  });

  // Fetch English translations as template
  const { data: enTranslations = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/translations", "en"],
    enabled: true,
  });

  // Mutations
  const upsertLangMutation = useMutation({
    mutationFn: async (data: Partial<SupportedLanguageLite>) => {
      const res = await apiRequest("POST", "/api/languages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/languages"] });
      setIsAddOpen(false);
      setEditingLang(null);
      toast({ title: t("admin.languages.saved_success"), description: t("admin.languages.saved_desc") });
    },
    onError: (error) => {
      toast({ title: t("common.error", "Error"), description: t("admin.languages.save_error"), variant: "destructive" });
    },
  });

  const deleteLangMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("DELETE", `/api/languages/${code}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/languages"] });
      toast({ title: t("common.success", "Success"), description: t("admin.languages.deleted_success") });
    },
    onError: () => {
      toast({ title: t("common.error", "Error"), description: t("admin.languages.delete_error"), variant: "destructive" });
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
      toast({ title: t("common.saved", "Saved"), description: t("admin.languages.translation_updated") });
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
      
      if (data.remaining > 0) {
        toast({ 
          title: t("admin.languages.batch_complete"), 
          description: t("admin.languages.batch_desc", { translated: data.translated, remaining: data.remaining })
        });
        // Recursively call to translate next batch
        setTimeout(() => autoTranslateMutation.mutate(), 1000);
      } else {
        toast({ 
          title: t("admin.languages.translation_complete"), 
          description: t("admin.languages.translation_complete_desc")
        });
      }
    },
    onError: (error: Error) => {
      const message = error.message || t("admin.languages.auto_translate_error", "Auto translate error");
      toast({ 
        title: t("admin.languages.translation_failed"), 
        description: message.includes("Ollama")
          ? `${message} ${t("admin.languages.ai_hint", "Check Admin → AI Settings provider/API key and try again.")}`
          : message,
        variant: "destructive" 
      });
    },
  });

  // Form State
  const [formData, setFormData] = useState<Partial<SupportedLanguageLite>>({
    code: "",
    name: "",
    rootUri: "",
    isActive: true,
    isDefault: false,
  });

  const handleEdit = (lang: SupportedLanguageLite) => {
    setFormData(lang);
    setEditingLang(lang);
    setIsAddOpen(true);
  };

  const handleAdd = () => {
    setFormData({ code: "", name: "", rootUri: "", isActive: true, isDefault: false });
    setEditingLang(null);
    setIsAddOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertLangMutation.mutate(formData);
  };

  const translationKeys = Object.keys(enTranslations).length
    ? Object.keys(enTranslations).sort()
    : Object.keys(translations).sort();

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const missingCount = translationKeys.filter((k) => !(translations[k] || "").trim()).length;
  const filteredKeys = translationKeys.filter((k) => {
    const isMissing = !(translations[k] || "").trim();
    if (showMissingOnly && !isMissing) return false;
    if (!normalizedQuery) return true;
    const en = (enTranslations[k] || "").toLowerCase();
    const cur = (translations[k] || "").toLowerCase();
    return k.toLowerCase().includes(normalizedQuery) || en.includes(normalizedQuery) || cur.includes(normalizedQuery);
  });

  const primaryLang = languages.find((l) => l.isDefault) || languages.find((l) => l.code === "sr-Latn");
  const secondaryLang = languages.find((l) => l.code === "en");
  const selectedLang = languages.find((l) => l.code === selectedLangCode);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.translations", "Translations")}</h1>
          <p className="text-muted-foreground">
            {t("admin.languages.subtitle", "Manage app translations and supported languages")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="translations" className="w-full">
        <TabsList>
          <TabsTrigger value="languages">{t("admin.languages.tab_languages", "Languages")}</TabsTrigger>
          <TabsTrigger value="translations">{t("admin.languages.tab_translations", "Translations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("admin.languages.supported_languages")}</CardTitle>
                <CardDescription>
                  {t("admin.languages.supported_languages_desc")}
                </CardDescription>
              </div>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAdd}>
                    <Plus className="mr-2 h-4 w-4" /> {t("admin.languages.add_language")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingLang ? t("admin.languages.edit_language") : t("admin.languages.add_language")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("admin.languages.language_code")}</Label>
                      <Input 
                        placeholder="e.g. fr, de, es" 
                        value={formData.code} 
                        onChange={e => setFormData({...formData, code: e.target.value})}
                        disabled={!!editingLang} // Code is PK
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.languages.display_name")}</Label>
                      <Input 
                        placeholder="e.g. Français" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.languages.root_uri")}</Label>
                      <Input 
                        placeholder={t("admin.languages.root_uri_placeholder")} 
                        value={formData.rootUri || ""} 
                        onChange={e => setFormData({...formData, rootUri: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("admin.languages.root_uri_help", { code: formData.code })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="isActive" 
                          checked={formData.isActive} 
                          onCheckedChange={(c) => setFormData({...formData, isActive: c as boolean})}
                        />
                        <Label htmlFor="isActive">{t("admin.languages.active")}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="isDefault" 
                          checked={formData.isDefault} 
                          onCheckedChange={(c) => setFormData({...formData, isDefault: c as boolean})}
                          disabled={editingLang?.isDefault}
                        />
                        <Label htmlFor="isDefault">
                          {t("admin.languages.primary_language")}
                          {editingLang?.isDefault && <span className="text-xs text-muted-foreground ml-2">{t("admin.languages.cannot_unset")}</span>}
                        </Label>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={upsertLangMutation.isPending}>
                      {upsertLangMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("common.save", "Save")}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.languages.code")}</TableHead>
                    <TableHead>{t("admin.languages.name")}</TableHead>
                    <TableHead>{t("admin.languages.root_uri")}</TableHead>
                    <TableHead>{t("admin.languages.type")}</TableHead>
                    <TableHead>{t("admin.languages.status")}</TableHead>
                    <TableHead>{t("admin.languages.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingLangs ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">{t("common.loading", "Loading...")}</TableCell>
                    </TableRow>
                  ) : languages.map((lang) => (
                    <TableRow key={lang.code}>
                      <TableCell className="font-mono">{lang.code}</TableCell>
                      <TableCell>{lang.name}</TableCell>
                      <TableCell className="font-mono text-xs">{lang.rootUri || `/${lang.code}`}</TableCell>
                      <TableCell>
                        {lang.isDefault ? (
                          <Badge variant="default">{t("admin.languages.primary")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("admin.languages.secondary")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lang.isActive ? <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">{t("admin.languages.status_active")}</Badge> : <Badge variant="destructive">{t("admin.languages.status_inactive")}</Badge>}
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
                              if (confirm(t("admin.languages.confirm_delete", { name: lang.name }))) deleteLangMutation.mutate(lang.code);
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
                  <CardTitle>{t("admin.languages.translation_editor")}</CardTitle>
                  <CardDescription>{t("admin.languages.translation_editor_desc")}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-2 mr-2">
                    <div className="text-xs text-muted-foreground">
                      {filteredKeys.length}/{translationKeys.length}
                      {showMissingOnly ? ` · ${missingCount} ${t("admin.languages.missing", "missing")}` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={showMissingOnly}
                        onCheckedChange={(v) => setShowMissingOnly(Boolean(v))}
                        id="missing-only"
                      />
                      <Label htmlFor="missing-only" className="text-xs text-muted-foreground">
                        {t("admin.languages.show_missing_only", "Show missing only")}
                      </Label>
                    </div>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("admin.languages.search", "Search keys or text")}
                      className="h-9 w-[260px]"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => autoTranslateMutation.mutate()}
                    disabled={selectedLangCode === "en" || autoTranslateMutation.isPending}
                  >
                    {autoTranslateMutation.isPending ? (
                       <>
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         {t("admin.languages.translating")}
                       </>
                    ) : (
                       <>
                         <Sparkles className="mr-2 h-4 w-4" />
                         {t("admin.languages.auto_translate_all")}
                       </>
                    )}
                  </Button>
                  <Globe className="h-4 w-4 text-muted-foreground ml-2" />
                  <select 
                    className="h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedLangCode}
                    onChange={(e) => setSelectedLangCode(e.target.value)}
                  >
                    {[...languages]
                      .sort((a, b) => {
                        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
                        if (a.code === "en") return 1;
                        if (b.code === "en") return -1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name}{l.isDefault ? ` (${t("admin.languages.primary", "Primary")})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex md:hidden flex-col gap-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {filteredKeys.length}/{translationKeys.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={showMissingOnly}
                      onCheckedChange={(v) => setShowMissingOnly(Boolean(v))}
                      id="missing-only-mobile"
                    />
                    <Label htmlFor="missing-only-mobile" className="text-xs text-muted-foreground">
                      {t("admin.languages.show_missing_only", "Show missing only")}
                    </Label>
                  </div>
                </div>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("admin.languages.search", "Search keys or text")}
                  className="h-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTrans ? (
                <div className="text-center py-8">{t("admin.languages.loading_translations")}</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground border-b pb-2">
                    <div className="col-span-4">{t("admin.languages.key")}</div>
                    <div className="col-span-4">{secondaryLang?.name || t("admin.languages.english_reference")}</div>
                    <div className="col-span-4">{selectedLang?.name || primaryLang?.name || t("admin.languages.translation")}</div>
                  </div>
                  {filteredKeys.map((key) => (
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
