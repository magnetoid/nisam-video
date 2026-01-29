import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction,
} from "@/components/ui/toast";
import { Copy, FileText, Check } from "lucide-react";
import { useState } from "react";

export function Toaster() {
  const { toasts } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loggedId, setLoggedId] = useState<string | null>(null);

  const handleCopy = (id: string, title: any, description: any, details: any) => {
    try {
        const text = `Error: ${title}\nDetails: ${description}\n\nTechnical Info:\n${details || "N/A"}`;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
        console.error("Failed to copy", err);
    }
  };

  const handleLog = async (id: string, title: any, description: any, details: any) => {
      try {
          await fetch("/api/client-logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  error: String(title),
                  info: String(description) + (details ? `\n\n${details}` : ""),
                  url: window.location.href
              })
          });
          setLoggedId(id);
          setTimeout(() => setLoggedId(null), 2000);
      } catch (e) {
          console.error("Failed to log", e);
      }
  };

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, details, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {details && (
                <div className="mt-2 text-[10px] opacity-80 bg-black/20 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto border border-white/10">
                  {details}
                </div>
              )}
            </div>
            {action}
            {variant === "destructive" && (
                <div className="flex gap-2">
                    <ToastAction 
                        altText="Copy error details" 
                        onClick={() => handleCopy(id, title, description, details)}
                        className="h-8 w-8 p-0 border-white/20 hover:bg-white/20 hover:text-white"
                    >
                        {copiedId === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </ToastAction>
                    <ToastAction 
                        altText="Send error log to server" 
                        onClick={() => handleLog(id, title, description, details)}
                        className="h-8 w-8 p-0 border-white/20 hover:bg-white/20 hover:text-white"
                    >
                        {loggedId === id ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </ToastAction>
                </div>
            )}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
