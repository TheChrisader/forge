import { type ReactNode } from "react";
import { Navigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "./AuthContext";
import { usePermission, useMinRole } from "./usePermission";
import { Spinner } from "@/shared/components/ui/spinner";

interface PermissionRequirement {
  resource: string;
  action: string;
}

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: PermissionRequirement;
  minRole?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

export function ProtectedRoute({
  children,
  permission,
  minRole,
}: ProtectedRouteProps): React.ReactElement | null {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  const hasPermission = permission ? usePermission(permission.resource, permission.action) : true;

  const hasMinRole = minRole ? useMinRole(minRole) : true;

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

  if (!hasPermission || !hasMinRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
