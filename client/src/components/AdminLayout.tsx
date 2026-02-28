import { ReactNode, useState } from "react";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 pt-16 overflow-hidden relative">
        <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background relative w-0 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
