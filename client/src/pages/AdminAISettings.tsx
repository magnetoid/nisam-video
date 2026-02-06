import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminSidebar } from "@/components/AdminSidebar";
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

// Schema for AI Settings
const aiSettingsSchema = z.object({
  provider: z.enum(["openai", "ollama"]),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional(),
  ollamaUrl: z.string().default("http://localhost:11434"),
  ollamaModel: z.string().optional(),
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
        title: "Settings Saved",
        description: "AI configuration has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncModelsMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/ai/ollama/sync", { url });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/models"] });
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${data.count} models.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
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
          title: "Connection Successful",
          description: "Successfully connected to the AI provider.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Could not connect to provider.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message });
      toast({
        title: "Test Failed",
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
    setIsSyncing(true);
    await syncModelsMutation.mutateAsync(url);
    setIsSyncing(false);
  };

  const handleTest = async () => {
    const data = {
      provider: form.getValues("provider"),
      url: form.getValues("ollamaUrl"),
      apiKey: form.getValues("openaiApiKey"),
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
    if (confirm("Run database migration to create missing AI tables?")) {
      runMigrationMutation.mutate();
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-8 ml-[240px]">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Bot className="h-8 w-8 text-primary" />
                AI Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure AI providers and manage models
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
                Fix Database Tables
              </Button>
              <Badge variant={config?.provider === "ollama" ? "secondary" : "default"}>
                Current Provider: {config?.provider === "ollama" ? "Ollama" : "OpenAI"}
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
                    Provider Settings
                  </CardTitle>
                  <CardDescription>
                    Choose and configure your AI backend
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
                            <FormLabel>AI Provider</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
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
                                <FormLabel>API Key</FormLabel>
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
                                <FormLabel>Model</FormLabel>
                                <FormControl>
                                  <Input placeholder="gpt-5" {...field} />
                                </FormControl>
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
                                <FormLabel>Ollama URL</FormLabel>
                                <FormControl>
                                  <Input placeholder="http://localhost:11434 (or remote URL)" {...field} />
                                </FormControl>
                                <FormDescription>
                                  URL of your Ollama instance. Must be publicly accessible if deployed.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* Selected active model display */}
                          <div className="p-3 bg-muted rounded-md text-sm">
                            <span className="font-medium">Active Model:</span>{" "}
                            {form.watch("ollamaModel") || "None selected"}
                          </div>
                        </>
                      )}

                      <div className="flex flex-col gap-2 pt-2">
                        <Button type="submit" disabled={updateConfigMutation.isPending}>
                          {updateConfigMutation.isPending ? "Saving..." : "Save Settings"}
                        </Button>
                        
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={handleTest}
                            disabled={isTesting}
                          >
                            {isTesting ? "Testing..." : "Test Connection"}
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
                        Available Models
                      </CardTitle>
                      <CardDescription>
                        Manage models from your Ollama server
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                      Sync Models
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">Active</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Family</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Params</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {models.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No models found. Click "Sync Models" to fetch from server.
                              </TableCell>
                            </TableRow>
                          ) : (
                            models.map((model) => (
                              <TableRow key={model.id}>
                                <TableCell>
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="radio"
                                      name="activeModel"
                                      className="h-4 w-4 text-primary"
                                      checked={form.watch("ollamaModel") === model.name}
                                      onChange={() => {
                                        form.setValue("ollamaModel", model.name, { shouldDirty: true });
                                        // Auto-save when selecting model? Or require save button?
                                        // Better to let user click save, but update local state
                                      }}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{model.name}</TableCell>
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
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      OpenAI Status
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
                            <div className="font-medium">Service Status</div>
                            <div className="text-sm text-muted-foreground">Operational</div>
                          </div>
                        </div>
                        <Badge variant="outline">Online</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                            <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium">Selected Model</div>
                            <div className="text-sm text-muted-foreground">{form.watch("openaiModel")}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
