import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AdminSEOEnhanced() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/admin/seo");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-sm text-muted-foreground">Redirecting…</div>
    </div>
  );
}
