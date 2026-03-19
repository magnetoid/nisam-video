import { Component, ReactNode } from "react";
import { clearCachesAndReload } from "@/lib/clearCachesAndReload";

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown | null }
> {
  state: { error: unknown | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("AppErrorBoundary caught an error:", error, errorInfo);

    const message = error instanceof Error ? error.message : String(error);
    const isUndefinedT = /\bt is not defined\b/.test(message);
    const isHookMismatch =
      message.includes("Minified React error #310") ||
      message.includes("Rendered more hooks than during the previous render");

    if (isHookMismatch || isUndefinedT) {
      try {
        const key = isUndefinedT ? "undefined_t_recovered_at" : "react_hook_mismatch_recovered_at";
        const last = sessionStorage.getItem(key);
        const now = Date.now();
        if (!last || now - parseInt(last, 10) > 10_000) {
          sessionStorage.setItem(key, String(now));
          void clearCachesAndReload();
        }
      } catch {
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">
              We encountered an unexpected error. Please try reloading the page.
            </p>
            <div className="p-4 bg-muted/50 rounded-lg text-left overflow-auto max-h-[200px] text-xs font-mono mb-4">
              {this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}
            </div>
            <button
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium"
              onClick={() => void clearCachesAndReload()}
              type="button"
            >
              Reload (clear cache)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
