import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnalyticsEvent } from "@shared/schema";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";

export default function AdminAnalyticsConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AnalyticsEvent | null>(null);

  // Settings Query
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/admin/analytics/settings"],
  });

  // Events Query
  const { data: events, isLoading: isLoadingEvents } = useQuery<AnalyticsEvent[]>({
    queryKey: ["/api/admin/analytics/events"],
  });

  // Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", "/api/admin/analytics/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/settings"] });
      toast({ title: "Settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });

  // Create Event Mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/analytics/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/events"] });
      setIsEventDialogOpen(false);
      toast({ title: "Event created" });
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
    },
  });

  // Update Event Mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PUT", `/api/admin/analytics/events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/events"] });
      setIsEventDialogOpen(false);
      setEditingEvent(null);
      toast({ title: "Event updated" });
    },
    onError: () => {
      toast({ title: "Failed to update event", variant: "destructive" });
    },
  });

  // Delete Event Mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/analytics/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/events"] });
      toast({ title: "Event deleted" });
    },
  });

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      gtmId: formData.get("gtmId"),
      ga4Id: formData.get("ga4Id"),
    };
    updateSettingsMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminSidebar />
      <main className="ml-60 pt-16 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Analytics Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Configure Google Tag Manager, GA4, and custom event tracking
            </p>
          </div>

          <Tabs defaultValue="settings">
            <TabsList>
              <TabsTrigger value="settings">General Settings</TabsTrigger>
              <TabsTrigger value="events">Event Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>
                    Configure your analytics provider IDs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSettings ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <form onSubmit={handleSettingsSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="gtmId">Google Tag Manager ID (GTM-XXXXXX)</Label>
                        <Input
                          id="gtmId"
                          name="gtmId"
                          defaultValue={settings?.gtmId || ""}
                          placeholder="GTM-XXXXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ga4Id">Google Analytics 4 ID (G-XXXXXXXXXX)</Label>
                        <Input
                          id="ga4Id"
                          name="ga4Id"
                          defaultValue={settings?.ga4Id || ""}
                          placeholder="G-XXXXXXXXXX"
                        />
                      </div>
                      <Button type="submit" disabled={updateSettingsMutation.isPending}>
                        {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Custom Events</CardTitle>
                    <CardDescription>
                      Configure automated event tracking for specific elements
                    </CardDescription>
                  </div>
                  <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setEditingEvent(null)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingEvent ? "Edit Event" : "Create Event"}</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target as HTMLFormElement);
                          const data = {
                            eventName: formData.get("eventName"),
                            triggerType: formData.get("triggerType"),
                            selector: formData.get("selector"),
                            isActive: formData.get("isActive") === "on" ? 1 : 0,
                          };
                          
                          if (editingEvent) {
                            updateEventMutation.mutate({ id: editingEvent.id, data });
                          } else {
                            createEventMutation.mutate(data);
                          }
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="eventName">Event Name</Label>
                          <Input
                            id="eventName"
                            name="eventName"
                            defaultValue={editingEvent?.eventName}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="triggerType">Trigger Type</Label>
                          <Select name="triggerType" defaultValue={editingEvent?.triggerType || "click"}>
                             <SelectTrigger>
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="click">Click</SelectItem>
                               <SelectItem value="form_submit">Form Submit</SelectItem>
                             </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="selector">CSS Selector</Label>
                          <Input
                            id="selector"
                            name="selector"
                            defaultValue={editingEvent?.selector || ""}
                            placeholder=".btn-primary, #submit-form"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="isActive"
                            name="isActive"
                            defaultChecked={editingEvent ? editingEvent.isActive === 1 : true}
                          />
                          <Label htmlFor="isActive">Active</Label>
                        </div>
                        <Button type="submit" className="w-full">
                          {editingEvent ? "Update Event" : "Create Event"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {isLoadingEvents ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Selector</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events?.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.eventName}</TableCell>
                            <TableCell>{event.triggerType}</TableCell>
                            <TableCell className="font-mono text-xs">{event.selector}</TableCell>
                            <TableCell>
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                event.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                              }`}>
                                {event.isActive ? "Active" : "Inactive"}
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
                                  if (confirm("Are you sure?")) {
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
      </main>
    </div>
  );
}
