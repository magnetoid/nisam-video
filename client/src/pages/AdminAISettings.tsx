import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Bot, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Server, 
  Cpu, 
  Settings2,
  Database,
  Radio
} from "lucide-react";

const OPENAI_MODEL_PRESETS: Array<{ value: string; label: string; notes?: string }> = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini", notes: "Fast, low cost" },
  { value: "gpt-4o", label: "gpt-4o", notes: "Best general" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { value: "gpt-4.1", label: "gpt-4.1" },
  { value: "o3-mini", label: "o3-mini", notes: "Reasoning" },
];

// Schema for AI Settings
const aiSettingsSchema = z.object({
  provider: z.enum(["openai", "ollama"]),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional(),
  ollamaUrl: z.string().default("http://localhost:11434"),
  ollamaModel: z.string().optional(),
  ollamaApiKey: z.string().optional(),
});

type AiSettings = z.infer<typeof aiSettingsSchema>;

interface AiModel {
  id: string;
  provider: string;
  name: string;
  size: string;
  digest: string;
  family: string;
  format: string;
  parameterSize: string;
  quantizationLevel: string;
  isActive: boolean;
  lastSyncedAt: string;
}

export default function AdminAISettings() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const didHydrateFromServerRef = useRef(false);

  // Fetch AI Config
  const { data: config, isLoading: configLoading } = useQuery<AiSettings>({
    queryKey: ["/api/ai/config"],
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Fetch AI Models
  const { data: models = [], isLoading: modelsLoading } = useQuery<AiModel[]>({
    queryKey: ["/api/ai/models"],
    refetchOnWindowFocus: false,
    retry: false,
  });

  const form = useForm<AiSettings>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      provider: "openai",
      openaiApiKey: "",
      openaiBaseUrl: "",
      openaiModel: "gpt-5",
      ollamaUrl: "http://localhost:11434",
      ollamaModel: "",
      ollamaApiKey: "",
    },
  });

  // Update form when config loads
  useEffect(() => {
    if (config) {
      if (didHydrateFromServerRef.current && form.formState.isDirty) return;
      form.reset({
        provider: config.provider as "openai" | "ollama",
        openaiApiKey: config.openaiApiKey || "",
        openaiBaseUrl: config.openaiBaseUrl || "",
        openaiModel: config.openaiModel || "gpt-5",
        ollamaUrl: config.ollamaUrl || "http://localhost:11434",
        ollamaModel: config.ollamaModel || "",
        ollamaApiKey: config.ollamaApiKey || "",
      });
      didHydrateFromServerRef.current = true;
    }
  }, [config, form.reset, form.formState.isDirty]);

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: async (data: AiSettings) => {
      await apiRequest("PATCH", "/api/ai/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/config"] });
      const data = form.getValues();
      form.reset(data);
      toast({
        title: t("common.success", "Success"),
        description: t("admin.aiSettingsSaved", "AI configuration has been updated successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncModelsMutation = useMutation({
    mutationFn: async (data: { url: string; apiKey?: string }) => {
      const res = await apiRequest("POST", "/api/ai/ollama/sync", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
      toast({
        title: t("admin.syncComplete", "Sync Complete"),
        description: t("admin.syncCompleteDesc", { count: data.count, defaultValue: "Successfully synced {{count}} models." }),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.syncFailed", "Sync Failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (data: { provider: string; url?: string; apiKey?: string }) => {
      const res = await apiRequest("POST", "/api/ai/test", data);
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast({
          title: t("common.connected", "Connected"),
          description: t("admin.aiConnectionSuccess", "Successfully connected to the AI provider."),
        });
      } else {
        toast({
          title: t("admin.connectionFailed", "Connection Failed"),
          description: data.error || t("admin.connectionFailedDesc", "Could not connect to provider."),
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message });
      toast({
        title: t("admin.testFailed", "Test Failed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleModelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/ai/models/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
    },
  });

  const onSubmit = (data: AiSettings) => {
    updateConfigMutation.mutate(data);
  };

  const handleSync = async () => {
    const url = form.getValues("ollamaUrl");
    const apiKeyRaw = form.getValues("ollamaApiKey");
    const apiKey = apiKeyRaw && apiKeyRaw !== "********" ? apiKeyRaw : undefined;
    setIsSyncing(true);
    await syncModelsMutation.mutateAsync({ url, apiKey });
    setIsSyncing(false);
  };

  const handleTest = async () => {
    const provider = form.getValues("provider");
    const openaiKeyRaw = form.getValues("openaiApiKey");
    const ollamaKeyRaw = form.getValues("ollamaApiKey");
    const openaiApiKey = openaiKeyRaw && openaiKeyRaw !== "********" ? openaiKeyRaw : undefined;
    const ollamaApiKey = ollamaKeyRaw && ollamaKeyRaw !== "********" ? ollamaKeyRaw : undefined;

    const data =
      provider === "ollama"
        ? {
            provider,
            url: form.getValues("ollamaUrl"),
            apiKey: ollamaApiKey,
          }
        : {
            provider,
            url: form.getValues("openaiBaseUrl") || undefined,
            apiKey: openaiApiKey,
          };
    setIsTesting(true);
    await testConnectionMutation.mutateAsync(data);
    setIsTesting(false);
  };

  const formatSize = (bytes: string | number) => {
    if (!bytes) return "-";
    const num = Number(bytes);
    if (isNaN(num)) return bytes;
    return (num / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const runMigrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/run-migration", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Migration Result",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      // Refresh config in case it was missing
      queryClient.invalidateQueries({ queryKey: ["/api/ai/config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Migration Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleMigration = () => {
    if (confirm(t("admin.confirmMigration", "Run database migration to create missing AI tables?"))) {
      runMigrationMutation.mutate();
    }
  };

  return (
    <div className="w-full space-y-6 relative z-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            {t("admin.aiSettings", "AI Settings")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.aiSettingsDesc", "Configure AI providers and manage models")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMigration}
            className="mr-2"
          >
            <Database className="h-4 w-4 mr-2" />
            {t("admin.fixDbTables", "Fix Database Tables")}
          </Button>
          <Badge variant={config?.provider === "ollama" ? "secondary" : "default"}>
            {t("admin.currentProvider", "Current Provider")}: {config?.provider === "ollama" ? "Ollama" : "OpenAI"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Configuration Column */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                {t("admin.providerSettings", "Provider Settings")}
              </CardTitle>
              <CardDescription>
                {t("admin.providerSettingsDesc", "Choose and configure your AI backend")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("admin.aiProvider", "AI Provider")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("admin.selectProvider", "Select provider")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="ollama">Ollama (Local/Custom)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("provider") === "openai" ? (
                    <>
                      <FormField
                        control={form.control}
                        name="openaiApiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("admin.apiKey", "API Key")}</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="sk-..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="openaiModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("common.model", "Model")}</FormLabel>
                            <Select
                              value={
                                OPENAI_MODEL_PRESETS.some((m) => m.value === field.value)
                                  ? (field.value as string)
                                  : "custom"
                              }
                              onValueChange={(value) => {
                                if (value === "custom") {
                                  field.onChange("");
                                  return;
                                }
                                field.onChange(value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("admin.selectModel", "Select a model")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {OPENAI_MODEL_PRESETS.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                                <SelectItem value="custom">{t("admin.custom", "Custom...")}</SelectItem>
                              </SelectContent>
                            </Select>
                            {!OPENAI_MODEL_PRESETS.some((m) => m.value === form.watch("openaiModel")) && (
                              <FormControl>
                                <Input placeholder={t("admin.customModelId", "Custom model id")} {...field} />
                              </FormControl>
                            )}
                            <FormDescription>
                              {t("admin.modelDesc", "Pick a preset or enter a custom model id.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="ollamaUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("admin.ollamaUrl", "Ollama URL")}</FormLabel>
                            <div className="flex gap-2 items-center relative z-20">
                              <FormControl>
                                <Input 
                                  placeholder="http://localhost:11434 (or remote URL)" 
                                  autoComplete="off"
                                  spellCheck={false}
                                  className="bg-background relative z-30"
                                  {...field} 
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => form.setValue("ollamaUrl", "https://ollama.com", { shouldDirty: true })}
                                title="Set to Official Cloud URL"
                              >
                                {t("admin.cloud", "Cloud")}
                              </Button>
                            </div>
                            <FormDescription>
                              {t("admin.ollamaUrlDesc", "URL of your Ollama instance. Use 'https://ollama.com' for official cloud.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ollamaApiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("admin.ollamaApiKey", "Ollama API Key (Optional)")}</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder={t("admin.keyForRemoteAuth", "Key for remote auth")} {...field} />
                            </FormControl>
                            <FormDescription>
                              {t("admin.ollamaApiKeyDesc", "Required if your remote Ollama service uses authentication.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="ollamaModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("admin.selectedModel", "Selected Model")}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("admin.selectModel", "Select a model")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {models.length === 0 ? (
                                   <SelectItem value="_placeholder" disabled>{t("admin.syncModelsFirst", "Sync models first")}</SelectItem>
                                ) : (
                                   models.filter(m => m.isActive).map((m) => (
                                     <SelectItem key={m.id} value={m.name}>
                                       {m.name} ({formatSize(m.size)})
                                     </SelectItem>
                                   ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {t("admin.modelCategorizationDesc", "Model used for categorization and tagging.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <Button type="submit" disabled={updateConfigMutation.isPending}>
                      {updateConfigMutation.isPending ? t("common.saving", "Saving...") : t("common.saveSettings", "Save Settings")}
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleTest}
                        disabled={isTesting}
                      >
                        {isTesting ? t("admin.testing", "Testing...") : t("admin.testConnection", "Test Connection")}
                      </Button>
                      {testResult && (
                        <div className="flex items-center justify-center px-2">
                          {testResult.success ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Models Column */}
        <div className="md:col-span-2 space-y-6">
          {form.watch("provider") === "ollama" ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {t("admin.availableModels", "Available Models")}
                  </CardTitle>
                  <CardDescription>
                    {t("admin.availableModelsDesc", "Manage models from your Ollama server")}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                  {t("admin.syncModels", "Sync Models")}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.name", "Name")}</TableHead>
                        <TableHead>{t("admin.family", "Family")}</TableHead>
                        <TableHead>{t("common.size", "Size")}</TableHead>
                        <TableHead>{t("admin.params", "Params")}</TableHead>
                        <TableHead className="text-right">{t("common.enabled", "Enabled")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {models.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {t("admin.noModelsFound", "No models found. Click \"Sync Models\" to fetch from server.")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        models.map((model) => (
                          <TableRow key={model.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {model.name}
                                {form.watch("ollamaModel") === model.name && (
                                  <Badge variant="secondary" className="text-[10px] h-5">{t("common.selected", "Selected")}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{model.family || "-"}</TableCell>
                            <TableCell>{formatSize(model.size)}</TableCell>
                            <TableCell>{model.parameterSize || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={model.isActive}
                                onCheckedChange={(checked) =>
                                  toggleModelMutation.mutate({ id: model.id, isActive: checked })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {t("admin.openaiStatus", "OpenAI Status")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <div className="font-medium">{t("admin.serviceStatus", "Service Status")}</div>
                          <div className="text-sm text-muted-foreground">{t("admin.configuredByEnv", "Configured by API key")}</div>
                        </div>
                      </div>
                      <Badge variant="outline">{t("common.info", "Info")}</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                          <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium">{t("admin.selectedModel", "Selected Model")}</div>
                          <div className="text-sm text-muted-foreground">{form.watch("openaiModel")}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    {t("admin.availableOpenaiModels", "Available OpenAI Models")}
                  </CardTitle>
                  <CardDescription>
                    {t("admin.presetsDesc", "Presets you can choose from in this app")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.name", "Name")}</TableHead>
                          <TableHead>{t("common.notes", "Notes")}</TableHead>
                          <TableHead className="text-right">{t("common.action", "Action")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {OPENAI_MODEL_PRESETS.map((m) => (
                          <TableRow key={m.value}>
                            <TableCell className="font-medium">{m.label}</TableCell>
                            <TableCell>{m.notes || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={form.watch("openaiModel") === m.value ? "default" : "outline"}
                                onClick={() => form.setValue("openaiModel", m.value, { shouldDirty: true })}
                              >
                                {t("common.use", "Use")}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
