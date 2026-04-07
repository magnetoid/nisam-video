import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { SystemSettings, AnalyticsEvent, EmailSettings } from "@shared/schema";
import { insertSystemSettingsSchema, insertEmailSettingsSchema } from "@shared/schema";
import {
  Settings,
  AlertTriangle,
  Sliders,
  Code,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Activity,
  Smartphone,
  Shield
} from "lucide-react";
import { Label } from "@/components/ui/label";

export default function AdminSystemSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  // --- System Settings Logic ---
  const { data: settings, isLoading: isLoadingSettings } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
  });

  const updateSettingsMutation = useMutation({
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
        title: t("admin.settingsUpdated", "Settings Updated"),
        description: t("admin.systemSettingsSaved", "System settings have been saved successfully."),
      });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToUpdateSettings", "Failed to update system settings."),
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
      clientErrorLogging: 1,
      gtmId: "",
      ga4Id: "",
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
        clientErrorLogging: settings.clientErrorLogging,
        gtmId: settings.gtmId || "",
        ga4Id: settings.ga4Id || "",
        customHeadCode: settings.customHeadCode || "",
        customBodyStartCode: settings.customBodyStartCode || "",
        customBodyEndCode: settings.customBodyEndCode || "",
      });
    }
  }, [settings, form]);

  const onSettingsSubmit = (data: any) => {
    updateSettingsMutation.mutate(data);
  };

  // --- Email Settings Logic ---
  const { data: emailSettings, isLoading: isLoadingEmailSettings } =
    useQuery<EmailSettings>({
      queryKey: ["/api/admin/email-settings"],
      queryFn: async () => {
        const res = await apiRequest("GET", "/api/admin/email-settings");
        return res.json();
      },
    });

  const updateEmailSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/admin/email-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-settings"] });
      toast({ title: t("admin.emailSettingsSaved", "Email settings saved") });
    },
    onError: () => {
      toast({
        title: t("common.error", "Error"),
        description: t("admin.failedToSaveEmailSettings", "Failed to save email settings"),
        variant: "destructive",
      });
    },
  });

  const emailForm = useForm({
    resolver: zodResolver(insertEmailSettingsSchema),
    defaultValues: {
      mode: "smtp",
      smtpHost: "",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      smtpSecure: 1,
      smtpFromEmail: "",
      smtpFromName: "",
      imapHost: "",
      imapPort: 993,
      imapUsername: "",
      imapPassword: "",
      imapSecure: 1,
      imapMailbox: "INBOX",
    },
  });

  useEffect(() => {
    if (emailSettings && !emailForm.formState.isDirty) {
      emailForm.reset({
        mode: (emailSettings.mode as any) || "smtp",
        smtpHost: emailSettings.smtpHost || "",
        smtpPort: emailSettings.smtpPort || 587,
        smtpUsername: emailSettings.smtpUsername || "",
        smtpPassword: (emailSettings.smtpPassword as any) || "",
        smtpSecure: emailSettings.smtpSecure ?? 1,
        smtpFromEmail: emailSettings.smtpFromEmail || "",
        smtpFromName: emailSettings.smtpFromName || "",
        imapHost: emailSettings.imapHost || "",
        imapPort: emailSettings.imapPort || 993,
        imapUsername: emailSettings.imapUsername || "",
        imapPassword: (emailSettings.imapPassword as any) || "",
        imapSecure: emailSettings.imapSecure ?? 1,
        imapMailbox: emailSettings.imapMailbox || "INBOX",
      });
    }
  }, [emailSettings, emailForm]);

  const onEmailSettingsSubmit = (data: any) => {
    updateEmailSettingsMutation.mutate(data);
  };

  // --- Analytics Events Logic ---
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AnalyticsEvent | null>(null);

  const { data: events, isLoading: isLoadingEvents } = useQuery<AnalyticsEvent[]>({
    queryKey: ["/api/admin/analytics/events"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/analytics/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/events"] });
      setIsEventDialogOpen(false);
      toast({ title: t("admin.eventCreated", "Event created") });
    },
    onError: () => {
      toast({ title: t("admin.failedToCreateEvent", "Failed to create event"), variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/admin/analytics/events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/events"] });
      setIsEventDialogOpen(false);
      setEditingEvent(null);
      toast({ title: t("admin.eventUpdated", "Event updated") });
    },
    onError: () => {
      toast({ title: t("admin.failedToUpdateEvent", "Failed to update event"), variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/analytics/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/events"] });
      toast({ title: t("admin.eventDeleted", "Event deleted") });
    },
  });

  if (isLoadingSettings || isLoadingEmailSettings) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">{t("admin.loadingSettings", "Loading settings...")}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
                <Settings className="h-8 w-8" />
                {t("admin.systemSettings", "System Settings")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("admin.systemSettingsDesc", "Configure general application settings, analytics, and events")}
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="general" className="flex items-center gap-2">
                  <Sliders className="h-4 w-4" />
                  {t("admin.general", "General")}
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t("admin.security", "Security")}
                </TabsTrigger>
                <TabsTrigger value="pwa" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  {t("admin.pwaMobile", "PWA & Mobile")}
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  {t("admin.email", "Email")}
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t("admin.ga4Gtm", "GA4 & GTM")}
                </TabsTrigger>
                <TabsTrigger value="events" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  {t("admin.advancedEvents", "Advanced Events")}
                </TabsTrigger>
              </TabsList>

              {/* --- General Tab --- */}
              <TabsContent value="general">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSettingsSubmit)} className="space-y-6">
                    {/* Maintenance Mode */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" />
                          {t("admin.maintenanceMode", "Maintenance Mode")}
                        </CardTitle>
                        <CardDescription>
                          {t("admin.maintenanceModeDesc", "Prevent public access while you make updates")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="maintenanceMode"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">{t("admin.enableMaintenanceMode", "Enable Maintenance Mode")}</FormLabel>
                                <FormDescription>
                                  {t("admin.maintenanceModeHelp", "Visitors will see a maintenance message")}
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value === 1}
                                  onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
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
                              <FormLabel>{t("admin.maintenanceMessage", "Maintenance Message")}</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={t("admin.maintenanceMessagePlaceholder", "We're currently performing maintenance...")}
                                  {...field}
                                  rows={3}
                                />
                              </FormControl>
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
                          {t("admin.displayFeatures", "Display & Features")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="itemsPerPage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.itemsPerPage", "Items Per Page")}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="12"
                                    max="48"
                                    step="6"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                  />
                                </FormControl>
                                <FormDescription>{t("admin.videosPerPage", "Videos per page (12-48)")}</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                            control={form.control}
                            name="pwaEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">{t("admin.pwaEnabled", "PWA Enabled")}</FormLabel>
                                    <FormDescription>{t("admin.allowMobileInstall", "Allow mobile installation")}</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                    checked={field.value === 1}
                                    onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
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
                                    <FormLabel className="text-base">{t("admin.allowRegistration", "Allow Registration")}</FormLabel>
                                    <FormDescription>{t("admin.publicSignup", "Public user signup")}</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                    checked={field.value === 1}
                                    onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                                    />
                                </FormControl>
                                </FormItem>
                            )}
                            />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateSettingsMutation.isPending}>
                        {updateSettingsMutation.isPending ? t("common.saving", "Saving...") : t("admin.saveGeneralSettings", "Save General Settings")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>

              {/* --- Security Tab (Turnstile) --- */}
              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {t("admin.turnstileTitle", "Cloudflare Turnstile")}
                    </CardTitle>
                    <CardDescription>
                      {t("admin.turnstileDescription", "Protect login and registration forms from bots using Cloudflare Turnstile. Get your site key and secret key from the Cloudflare dashboard.")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">{t("admin.turnstileEnable", "Enable Turnstile")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("admin.turnstileEnableDesc", "When enabled, users must pass a Turnstile challenge to log in or register.")}
                        </p>
                      </div>
                      <Switch
                        checked={settings?.turnstileEnabled === 1}
                        onCheckedChange={(checked) => {
                          updateSettingsMutation.mutate({ turnstileEnabled: checked ? 1 : 0 });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="turnstile-site-key">{t("admin.turnstileSiteKey", "Site Key")}</Label>
                      <Input
                        id="turnstile-site-key"
                        placeholder="0x4AAAAAAA..."
                        defaultValue={settings?.turnstileSiteKey || ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (settings?.turnstileSiteKey || "")) {
                            updateSettingsMutation.mutate({ turnstileSiteKey: val });
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("admin.turnstileSiteKeyDesc", "The public site key from your Cloudflare Turnstile widget configuration.")}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="turnstile-secret-key">{t("admin.turnstileSecretKey", "Secret Key")}</Label>
                      <Input
                        id="turnstile-secret-key"
                        type="password"
                        placeholder="0x4AAAAAAA..."
                        defaultValue={settings?.turnstileSecretKey || ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (settings?.turnstileSecretKey || "")) {
                            updateSettingsMutation.mutate({ turnstileSecretKey: val });
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("admin.turnstileSecretKeyDesc", "The private secret key. This is used server-side to verify Turnstile tokens. Never exposed to the client.")}
                      </p>
                    </div>

                    {settings?.turnstileEnabled === 1 && !settings?.turnstileSiteKey && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {t("admin.turnstileWarning", "Turnstile is enabled but no site key is configured. The widget will not appear until both keys are set.")}
                      </div>
                    )}

                    {settings?.turnstileEnabled === 1 && settings?.turnstileSiteKey && settings?.turnstileSecretKey && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-500 text-sm">
                        <Shield className="h-4 w-4 shrink-0" />
                        {t("admin.turnstileActive", "Turnstile is active. Login and registration forms are protected.")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* --- PWA Tab --- */}
              <TabsContent value="pwa">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSettingsSubmit)} className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Smartphone className="h-5 w-5" />
                          {t("admin.pwaConfig", "Progressive Web App Configuration")}
                        </CardTitle>
                        <CardDescription>
                          {t("admin.pwaConfigDesc", "Configure how the app appears when installed on devices (Mobile, TV, Desktop)")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="pwaEnabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">{t("admin.enablePwa", "Enable PWA")}</FormLabel>
                                <FormDescription>
                                  {t("admin.enablePwaDesc", "Allow users to install the app on their devices")}
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value === 1}
                                  onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="pwaName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.appName", "App Name")}</FormLabel>
                                <FormControl>
                                  <Input placeholder="nisam.video - AI Video Hub" {...field} />
                                </FormControl>
                                <FormDescription>{t("admin.appNameDesc", "Full name of the application")}</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="pwaShortName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.shortName", "Short Name")}</FormLabel>
                                <FormControl>
                                  <Input placeholder="nisam.video" {...field} />
                                </FormControl>
                                <FormDescription>{t("admin.shortNameDesc", "Used on home screen icons")}</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="pwaDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("common.description", "Description")}</FormLabel>
                              <FormControl>
                                <Textarea placeholder={t("admin.appDescription", "App description...")} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="pwaThemeColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.themeColor", "Theme Color")}</FormLabel>
                                <div className="flex gap-2">
                                  <div className="w-10 h-10 rounded border" style={{ backgroundColor: field.value }}></div>
                                  <FormControl>
                                    <Input placeholder="#E50914" {...field} />
                                  </FormControl>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="pwaBackgroundColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.backgroundColor", "Background Color")}</FormLabel>
                                <div className="flex gap-2">
                                  <div className="w-10 h-10 rounded border" style={{ backgroundColor: field.value }}></div>
                                  <FormControl>
                                    <Input placeholder="#141414" {...field} />
                                  </FormControl>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="pwaIcon192"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.icon192", "Icon 192x192 URL")}</FormLabel>
                                <FormControl>
                                  <Input placeholder="/icon-192.png" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="pwaIcon512"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.icon512", "Icon 512x512 URL")}</FormLabel>
                                <FormControl>
                                  <Input placeholder="/icon-512.png" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateSettingsMutation.isPending}>
                        {updateSettingsMutation.isPending ? t("common.saving", "Saving...") : t("admin.savePwaSettings", "Save PWA Settings")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="email">
                <Form {...emailForm}>
                  <form
                    onSubmit={emailForm.handleSubmit(onEmailSettingsSubmit)}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>{t("admin.emailSettings", "Email (SMTP / IMAP)")}</CardTitle>
                        <CardDescription>
                          {t("admin.emailSettingsDesc", "Configure email sending (SMTP) or mailbox access (IMAP)")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={emailForm.control}
                          name="mode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("admin.mode", "Mode")}</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-[240px]">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="smtp">{t("admin.smtp", "SMTP (send mail)")}</SelectItem>
                                  <SelectItem value="imap">{t("admin.imap", "IMAP (read mailbox)")}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {emailForm.watch("mode") === "smtp" ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField
                                control={emailForm.control}
                                name="smtpHost"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.smtpHost", "SMTP Host")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder="smtp.example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={emailForm.control}
                                name="smtpPort"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.smtpPort", "SMTP Port")}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        placeholder="587"
                                        value={field.value ?? ""}
                                        onChange={(e) =>
                                          field.onChange(
                                            e.target.value ? Number(e.target.value) : null,
                                          )
                                        }
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField
                                control={emailForm.control}
                                name="smtpUsername"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.smtpUsername", "SMTP Username")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder="user@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={emailForm.control}
                                name="smtpPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.smtpPassword", "SMTP Password")}</FormLabel>
                                    <FormControl>
                                      <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={emailForm.control}
                              name="smtpSecure"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">{t("admin.useTlsSsl", "Use TLS/SSL")}</FormLabel>
                                    <FormDescription>
                                      {t("admin.smtpSecureDesc", "Enable secure connection to SMTP server")}
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={(field.value ?? 1) === 1}
                                      onCheckedChange={(checked) =>
                                        field.onChange(checked ? 1 : 0)
                                      }
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField
                                control={emailForm.control}
                                name="smtpFromEmail"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.fromEmail", "From Email")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder="no-reply@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={emailForm.control}
                                name="smtpFromName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.fromName", "From Name")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder="nisam.video" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField
                                control={emailForm.control}
                                name="imapHost"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.imapHost", "IMAP Host")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder="imap.example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={emailForm.control}
                                name="imapPort"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.imapPort", "IMAP Port")}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        placeholder="993"
                                        value={field.value ?? ""}
                                        onChange={(e) =>
                                          field.onChange(
                                            e.target.value ? Number(e.target.value) : null,
                                          )
                                        }
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <FormField
                                control={emailForm.control}
                                name="imapUsername"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.imapUsername", "IMAP Username")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder="user@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={emailForm.control}
                                name="imapPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("admin.imapPassword", "IMAP Password")}</FormLabel>
                                    <FormControl>
                                      <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={emailForm.control}
                              name="imapSecure"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">{t("admin.useTlsSsl", "Use TLS/SSL")}</FormLabel>
                                    <FormDescription>
                                      {t("admin.imapSecureDesc", "Enable secure connection to IMAP server")}
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={(field.value ?? 1) === 1}
                                      onCheckedChange={(checked) =>
                                        field.onChange(checked ? 1 : 0)
                                      }
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={emailForm.control}
                              name="imapMailbox"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("admin.mailbox", "Mailbox")}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="INBOX" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateEmailSettingsMutation.isPending}>
                        {updateEmailSettingsMutation.isPending ? t("common.saving", "Saving...") : t("admin.saveEmailSettings", "Save Email Settings")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>

              {/* --- Analytics & GTM Tab --- */}
              <TabsContent value="analytics">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSettingsSubmit)} className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          {t("admin.googleAnalyticsTagManager", "Google Analytics & Tag Manager")}
                        </CardTitle>
                        <CardDescription>
                          {t("admin.googleAnalyticsTagManagerDesc", "Configure tracking IDs and custom scripts")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="gtmId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.gtmId", "Google Tag Manager ID (GTM-XXXXXX)")}</FormLabel>
                                <FormControl>
                                  <Input placeholder="GTM-XXXXXX" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="ga4Id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("admin.ga4Id", "Google Analytics 4 ID (G-XXXXXXXXXX)")}</FormLabel>
                                <FormControl>
                                  <Input placeholder="G-XXXXXXXXXX" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Code className="h-5 w-5" />
                          {t("admin.customCodeInjection", "Custom Code Injection")}
                        </CardTitle>
                        <CardDescription>
                          {t("admin.customCodeInjectionDesc", "Inject custom scripts into the page")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="customHeadCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("admin.headCode", "Head Code (<head>)")}</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="<!-- Code for <head> -->"
                                  {...field}
                                  rows={5}
                                  className="font-mono text-xs"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                            control={form.control}
                            name="customBodyStartCode"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t("admin.bodyStart", "Body Start (<body>)")}</FormLabel>
                                <FormControl>
                                    <Textarea
                                    placeholder="<!-- Code after <body> -->"
                                    {...field}
                                    rows={5}
                                    className="font-mono text-xs"
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="customBodyEndCode"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>{t("admin.bodyEnd", "Body End (</body>)")}</FormLabel>
                                <FormControl>
                                    <Textarea
                                    placeholder="<!-- Code before </body> -->"
                                    {...field}
                                    rows={5}
                                    className="font-mono text-xs"
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateSettingsMutation.isPending}>
                        {updateSettingsMutation.isPending ? t("common.saving", "Saving...") : t("admin.saveAnalyticsSettings", "Save Analytics Settings")}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>

              {/* --- Advanced Events Tab --- */}
              <TabsContent value="events">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{t("admin.customEventTracking", "Custom Event Tracking")}</CardTitle>
                      <CardDescription>
                        {t("admin.customEventTrackingDesc", "Define custom events to track user interactions")}
                      </CardDescription>
                    </div>
                    <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setEditingEvent(null)}>
                          <Plus className="h-4 w-4 mr-2" />
                          {t("admin.addEvent", "Add Event")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingEvent ? t("admin.editEvent", "Edit Event") : t("admin.createEvent", "Create Event")}</DialogTitle>
                        </DialogHeader>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target as HTMLFormElement);
                            const data = {
                              eventName: formData.get("eventName"),
                              ga4EventName: formData.get("ga4EventName"),
                              triggerType: formData.get("triggerType"),
                              selector: formData.get("selector"),
                              isActive: formData.get("isActive") === "on" ? 1 : 0,
                              sendToGa4: formData.get("sendToGa4") === "on",
                            };
                            
                            if (editingEvent) {
                              updateEventMutation.mutate({ id: editingEvent.id, data });
                            } else {
                              createEventMutation.mutate(data);
                            }
                          }}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="eventName">{t("admin.internalEventName", "Internal Event Name")}</Label>
                                <Input
                                    id="eventName"
                                    name="eventName"
                                    defaultValue={editingEvent?.eventName}
                                    placeholder="e.g. btn_signup_click"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ga4EventName">{t("admin.ga4EventName", "GA4 Event Name (Optional)")}</Label>
                                <Input
                                    id="ga4EventName"
                                    name="ga4EventName"
                                    defaultValue={editingEvent?.ga4EventName || ""}
                                    placeholder="e.g. sign_up"
                                />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="triggerType">{t("admin.triggerType", "Trigger Type")}</Label>
                            <Select name="triggerType" defaultValue={editingEvent?.triggerType || "click"}>
                               <SelectTrigger>
                                  <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="click">{t("admin.click", "Click")}</SelectItem>
                                 <SelectItem value="form_submit">{t("admin.formSubmit", "Form Submit")}</SelectItem>
                                 <SelectItem value="page_view">{t("admin.pageView", "Page View")}</SelectItem>
                               </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="selector">{t("admin.cssSelector", "CSS Selector / URL Pattern")}</Label>
                            <Input
                              id="selector"
                              name="selector"
                              defaultValue={editingEvent?.selector || ""}
                              placeholder=".btn-primary, #submit-form, or /pricing"
                            />
                          </div>
                          
                          <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="isActive"
                                    name="isActive"
                                    defaultChecked={editingEvent ? editingEvent.isActive === 1 : true}
                                />
                                <Label htmlFor="isActive">{t("common.active", "Active")}</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="sendToGa4"
                                    name="sendToGa4"
                                    defaultChecked={editingEvent ? editingEvent.sendToGa4 : true}
                                />
                                <Label htmlFor="sendToGa4">{t("admin.sendToGa4", "Send to Google Analytics 4")}</Label>
                            </div>
                          </div>

                          <Button type="submit" className="w-full">
                            {editingEvent ? t("admin.updateEvent", "Update Event") : t("admin.createEvent", "Create Event")}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {isLoadingEvents ? (
                      <div className="text-center py-4">{t("admin.loadingEvents", "Loading events...")}</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("admin.eventName", "Event Name")}</TableHead>
                            <TableHead>{t("admin.ga4Mapping", "GA4 Mapping")}</TableHead>
                            <TableHead>{t("admin.type", "Type")}</TableHead>
                            <TableHead>{t("admin.selector", "Selector")}</TableHead>
                            <TableHead>{t("common.status", "Status")}</TableHead>
                            <TableHead>{t("admin.ga4", "GA4")}</TableHead>
                            <TableHead className="text-right">{t("common.actions", "Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {events?.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium">{event.eventName}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{event.ga4EventName || "-"}</TableCell>
                              <TableCell>{event.triggerType}</TableCell>
                              <TableCell className="font-mono text-xs">{event.selector}</TableCell>
                              <TableCell>
                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  event.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                }`}>
                                  {event.isActive ? t("common.active", "Active") : t("common.inactive", "Inactive")}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  event.sendToGa4 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                                }`}>
                                  {event.sendToGa4 ? t("common.on", "On") : t("common.off", "Off")}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingEvent(event);
                                    setIsEventDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm(t("common.areYouSure", "Are you sure?"))) {
                                      deleteEventMutation.mutate(event.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
      </Tabs>
    </div>
  );
}