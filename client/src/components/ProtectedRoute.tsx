import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

interface SessionResponse {
  isAuthenticated: boolean;
  username: string | null;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  const { data: session, isLoading } = useQuery<SessionResponse>({
    queryKey: ["/api/auth/session"],
  });

  useEffect(() => {
    if (!isLoading && !session?.isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [session, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session?.isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
