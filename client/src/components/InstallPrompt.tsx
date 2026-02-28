import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { SystemSettings } from "@shared/schema";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
    // queryFn is handled by default query function in queryClient if configured, 
    // but better to be explicit or rely on the global fetcher.
    // Assuming global fetcher is used based on other files.
  });

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      // Only show if PWA is enabled in settings (default to enabled if settings not loaded yet)
      if (!settings || settings.pwaEnabled !== 0) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, [settings]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  // If explicitly disabled in settings, don't show
  if (settings?.pwaEnabled === 0) return null;
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg p-4 max-w-[300px] animate-in slide-in-from-bottom-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">Install App</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Install {settings?.pwaName || "nisam.video"} for a better experience.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 -mt-1 -mr-2" 
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2 w-full">
          <Button size="sm" onClick={handleInstall} className="flex-1 h-8 text-xs">
            <Download className="mr-2 h-3 w-3" />
            Install
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsVisible(false)} className="flex-1 h-8 text-xs">
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
