import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SystemSettings } from "@shared/schema";
import { insertSystemSettingsSchema } from "@shared/schema";
import { Settings, AlertTriangle, Sliders, Code } from "lucide-react";

export default function AdminSystemSettings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SystemSettings>) => {
      const response = await fetch("/api/system/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/settings"] });
      toast({
        title: "Settings Updated",
        description: "System settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update system settings.",
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertSystemSettingsSchema),
    defaultValues: {
      maintenanceMode: 0,
      maintenanceMessage: "",
      allowRegistration: 0,
      itemsPerPage: 24,
      pwaEnabled: 1,
      customHeadCode: "",
      customBodyStartCode: "",
      customBodyEndCode: "",
    },
  });

  useEffect(() => {
    if (settings && !form.formState.isDirty) {
      form.reset({
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage || "",
        allowRegistration: settings.allowRegistration,
        itemsPerPage: settings.itemsPerPage,
        pwaEnabled: settings.pwaEnabled,
        customHeadCode: settings.customHeadCode || "",
        customBodyStartCode: settings.customBodyStartCode || "",
        customBodyEndCode: settings.customBodyEndCode || "",
      });
    }
  }, [settings, form]);

  const onSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AdminSidebar />
        <main className="ml-60 pt-16 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading settings...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />

      <main className="ml-60 pt-16 p-8">
        <div className="space-y-6 max-w-4xl">
          <div>
            <h1
              className="text-3xl font-bold flex items-center gap-2"
              data-testid="text-page-title"
            >
              <Settings className="h-8 w-8" />
              System Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure general application settings
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Maintenance Mode */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Maintenance Mode
                  </CardTitle>
                  <CardDescription>
                    Enable maintenance mode to prevent public access while you
                    make updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="maintenanceMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Maintenance Mode
                          </FormLabel>
                          <FormDescription>
                            When enabled, visitors will see a maintenance
                            message
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value === 1}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? 1 : 0)
                            }
                            data-testid="switch-maintenance-mode"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maintenanceMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maintenance Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="We're currently performing maintenance. Please check back soon."
                            {...field}
                            data-testid="input-maintenance-message"
                            rows={3}
                          />
                        </FormControl>
                        <FormDescription>
                          Message displayed to visitors during maintenance
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Display Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sliders className="h-5 w-5" />
                    Display Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how content is displayed on the platform
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="itemsPerPage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Items Per Page</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="12"
                            max="48"
                            step="6"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value))
                            }
                            data-testid="input-items-per-page"
                          />
                        </FormControl>
                        <FormDescription>
                          Number of videos to display per page (12-48)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pwaEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Progressive Web App (PWA)
                          </FormLabel>
                          <FormDescription>
                            Enable PWA features for mobile installation
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value === 1}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? 1 : 0)
                            }
                            data-testid="switch-pwa-enabled"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="allowRegistration"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Allow User Registration
                          </FormLabel>
                          <FormDescription>
                            Enable public user registration (future feature)
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value === 1}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? 1 : 0)
                            }
                            data-testid="switch-allow-registration"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Custom Code Injection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Custom Code Injection
                  </CardTitle>
                  <CardDescription>
                    Add custom HTML, JavaScript, or tracking codes (GTM, analytics, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customHeadCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Head Code</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="<!-- Google Tag Manager, Analytics, or other <head> code -->"
                            {...field}
                            data-testid="input-custom-head-code"
                            rows={6}
                            className="font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          Code injected in &lt;head&gt; section (GTM, analytics, meta tags)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customBodyStartCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body Start Code</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="<!-- GTM noscript or other code right after <body> -->"
                            {...field}
                            data-testid="input-custom-body-start-code"
                            rows={6}
                            className="font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          Code injected immediately after &lt;body&gt; tag (GTM noscript)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customBodyEndCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body End Code</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="<!-- Tracking scripts or code before </body> -->"
                            {...field}
                            data-testid="input-custom-body-end-code"
                            rows={6}
                            className="font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          Code injected before &lt;/body&gt; tag (tracking, chat widgets)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  data-testid="button-reset"
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-save"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
