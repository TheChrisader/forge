import { type ReactNode } from "react";
import { Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";
import { Spinner } from "@/shared/components/ui/spinner";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps): React.ReactElement | null {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const currentPath = location.pathname;
    if (currentPath !== "/" && currentPath !== "/login") {
      return <Navigate to="/login" search={{ redirect: currentPath }} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
