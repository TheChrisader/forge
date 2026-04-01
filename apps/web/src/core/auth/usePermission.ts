import { useMemo } from "react";
import { useAuth } from "@/core/auth/AuthContext";

/**
 * Check if the current user has a specific permission.
 *
 * @example
 * const canDeploy = usePermission("deployments", "create");
 * if (canDeploy) { ... }
 */
export function usePermission(resource: string, action: string): boolean {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) return false;

    if (user.role === "admin") return true;

    return user.permissions.includes(`${resource}:${action}`);
  }, [user, resource, action]);
}

/**
 * Returns a `can` function for checking multiple permissions declaratively.
 *
 * @example
 * const { can } = usePermissions();
 *
 * return (
 *   <>
 *     {can("projects", "create") && <NewProjectButton />}
 *     {can("deployments", "delete") && <DeleteDeploymentButton />}
 *   </>
 * );
 */
export function usePermissions(): { can: (resource: string, action: string) => boolean } {
  const { user } = useAuth();

  const can = (resource: string, action: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.permissions.includes(`${resource}:${action}`);
  };

  return { can };
}

/**
 * Check if the current user has a minimum team role.
 */
export function useMinRole(minRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"): boolean {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user || user.role === "admin") return true;
    if (!user.currentTeamId) return false;

    const team = user.teams.find((t) => t.id === user.currentTeamId);
    if (!team) return false;

    const hierarchy: Record<string, number> = {
      OWNER: 4,
      ADMIN: 3,
      MEMBER: 2,
      VIEWER: 1,
    };

    return (hierarchy[team.role] ?? 0) >= (hierarchy[minRole] ?? 0);
  }, [user, minRole]);
}
