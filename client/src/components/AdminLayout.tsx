import { ReactNode } from "react";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

export function AdminLayout({
  children,
  title,
  description,
  actions,
  isLoading = false,
  loadingText = "Loading...",
}: AdminLayoutProps) {
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <AdminSidebar />
        <main className="ml-60 pt-16 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">{loadingText}</div>
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
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                {title}
              </h1>
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
