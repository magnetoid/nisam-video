import { Component, ReactNode } from "react";
import { clearCachesAndReload } from "@/lib/clearCachesAndReload";

export class AdminErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown | null }
> {
  state: { error: unknown | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : "Admin page failed to load.";

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-xl font-semibold">Admin failed to load</h1>
            <p className="text-sm text-muted-foreground break-words">{message}</p>
            <div className="flex flex-col gap-2">
              <button
                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
                onClick={() => window.location.reload()}
                type="button"
              >
                Reload
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
        </div>
      );
    }

    return this.props.children;
  }
}

export function AdminLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    </div>
  );
}
