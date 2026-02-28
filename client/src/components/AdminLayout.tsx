import { ReactNode, useState } from "react";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="md:ml-60 pt-16 p-4 md:p-8 min-h-[calc(100vh-64px)] transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
