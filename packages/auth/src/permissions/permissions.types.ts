export interface PermissionCheck {
  resource: string;
  action: string;
  resourceId?: string;
  teamId?: string;
}

export interface ResolvedPermission {
  resource: string;
  action: string;
  source: "platform_admin" | "role_assignment" | "team_role";
}

export const PERMISSION_CACHE_KEY = (userId: string): string => `perms:${userId}`;
export const PERMISSION_CACHE_TEAM_KEY = (userId: string, teamId: string): string =>
  `perms:${userId}:${teamId}`;
export const PERMISSION_CACHE_TTL = 300;
