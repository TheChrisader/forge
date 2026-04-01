import type { PrismaClient } from "@forge/database";
import type Redis from "ioredis";
import type { PermissionCheck, ResolvedPermission } from "./permissions.types.js";
import {
  PERMISSION_CACHE_KEY,
  PERMISSION_CACHE_TEAM_KEY,
  PERMISSION_CACHE_TTL,
} from "./permissions.types.js";
import { ForbiddenError } from "@forge/core";

export class PermissionsService {
  private db: PrismaClient;
  private redis: Redis;

  constructor(db: PrismaClient, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async check(userId: string, check: PermissionCheck): Promise<boolean> {
    try {
      await this.require(userId, check);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Assert that a user has a permission. Throws ForbiddenError if not.
   *
   * Resolution order (first match wins):
   * 1. Platform Admin — full access, bypass all checks
   * 2. Resource-scoped RoleAssignment — explicit role on specific resource
   * 3. Team role — user's TeamMember.role for the team that owns the resource
   * 4. Default — deny
   */
  async require(userId: string, check: PermissionCheck): Promise<void> {
    const permissions = check.teamId
      ? await this.getTeamPermissions(userId, check.teamId)
      : await this.getPermissions(userId);

    const hasPermission =
      permissions.some((p) => p.resource === "*" && p.action === "*") ||
      permissions.some(
        (p) => p.resource === check.resource && (p.action === "*" || p.action === check.action)
      );

    if (!hasPermission) {
      throw new ForbiddenError(`Insufficient permissions: ${check.resource}:${check.action}`);
    }
  }

  /**
   * Get all permissions for a user (across all teams and role assignments).
   * Results are cached in Redis with 5-minute TTL.
   */
  async getPermissions(userId: string): Promise<ResolvedPermission[]> {
    const cacheKey = PERMISSION_CACHE_KEY(userId);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ResolvedPermission[];
      }
    } catch {
      // Redis unavailable, fall through to DB query
    }

    const permissions = await this.resolvePermissions(userId);

    try {
      await this.redis.set(cacheKey, JSON.stringify(permissions), "EX", PERMISSION_CACHE_TTL);
    } catch {
      // Ignore cache write failures
    }

    return permissions;
  }

  /**
   * Get effective permissions for a user within a specific team context.
   * Combines global role assignments with team-role permissions.
   */
  async getTeamPermissions(userId: string, teamId: string): Promise<ResolvedPermission[]> {
    const cacheKey = PERMISSION_CACHE_TEAM_KEY(userId, teamId);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ResolvedPermission[];
      }
    } catch {
      // Redis unavailable, fall through to DB query
    }

    const permissions = await this.resolveTeamPermissions(userId, teamId);

    try {
      await this.redis.set(cacheKey, JSON.stringify(permissions), "EX", PERMISSION_CACHE_TTL);
    } catch {
      // Ignore cache write failures
    }

    return permissions;
  }

  /**
   * Invalidate cached permissions for a user.
   * Call this after role changes, team membership changes, or permission updates.
   */
  async invalidateUser(userId: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({
        match: `perms:${userId}*`,
        count: 100,
      });

      const keys: string[] = [];
      for await (const key of stream) {
        keys.push(key as string);
      }

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Ignore cache invalidation failures
    }
  }

  /**
   * Invalidate cached permissions for all members of a team.
   */
  async invalidateTeam(teamId: string): Promise<void> {
    try {
      const members = await this.db.teamMember.findMany({
        where: { teamId },
        select: { userId: true },
      });

      for (const member of members) {
        await this.invalidateUser(member.userId);
      }
    } catch {
      // Ignore cache invalidation failures
    }
  }

  private async resolvePermissions(userId: string): Promise<ResolvedPermission[]> {
    const result: ResolvedPermission[] = [];

    const platformAdminRole = await this.db.role.findFirst({
      where: { isSystem: true, name: "platform_admin" },
      include: {
        assignments: {
          where: { userId },
        },
      },
    });

    if (platformAdminRole && platformAdminRole.assignments.length > 0) {
      result.push({ resource: "*", action: "*", source: "platform_admin" });
      return result;
    }

    const roleAssignments = await this.db.roleAssignment.findMany({
      where: { userId },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    });

    for (const assignment of roleAssignments) {
      if (assignment.role.name === "platform_admin") continue;

      for (const rp of assignment.role.permissions) {
        result.push({
          resource: rp.permission.resource,
          action: rp.permission.action,
          source: "role_assignment",
        });
      }
    }

    const teamMemberships = await this.db.teamMember.findMany({
      where: { userId },
      include: {
        team: true,
      },
    });

    for (const membership of teamMemberships) {
      const teamRoleName = this.teamRoleToSystemRole(membership.role);
      if (!teamRoleName) continue;

      const teamRole = await this.db.role.findFirst({
        where: { isSystem: true, name: teamRoleName },
        include: { permissions: { include: { permission: true } } },
      });

      if (teamRole) {
        for (const rp of teamRole.permissions) {
          result.push({
            resource: rp.permission.resource,
            action: rp.permission.action,
            source: "team_role",
          });
        }
      }
    }

    return result;
  }

  private async resolveTeamPermissions(
    userId: string,
    teamId: string
  ): Promise<ResolvedPermission[]> {
    const result: ResolvedPermission[] = [];

    const platformAdminRole = await this.db.role.findFirst({
      where: { isSystem: true, name: "platform_admin" },
      include: { assignments: { where: { userId } } },
    });

    if (platformAdminRole && platformAdminRole.assignments.length > 0) {
      result.push({ resource: "*", action: "*", source: "platform_admin" });
      return result;
    }

    const roleAssignments = await this.db.roleAssignment.findMany({
      where: { userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    for (const assignment of roleAssignments) {
      if (assignment.role.name === "platform_admin") continue;

      for (const rp of assignment.role.permissions) {
        result.push({
          resource: rp.permission.resource,
          action: rp.permission.action,
          source: "role_assignment",
        });
      }
    }

    const membership = await this.db.teamMember.findUnique({
      where: { teamId_userId: { userId, teamId } },
    });

    if (membership) {
      const teamRoleName = this.teamRoleToSystemRole(membership.role);
      if (teamRoleName) {
        const teamRole = await this.db.role.findFirst({
          where: { isSystem: true, name: teamRoleName },
          include: { permissions: { include: { permission: true } } },
        });

        if (teamRole) {
          for (const rp of teamRole.permissions) {
            result.push({
              resource: rp.permission.resource,
              action: rp.permission.action,
              source: "team_role",
            });
          }
        }
      }
    }

    return result;
  }

  private teamRoleToSystemRole(
    role: string
  ): "team_owner" | "team_admin" | "team_member" | "team_viewer" | null {
    switch (role) {
      case "OWNER":
        return "team_owner";
      case "ADMIN":
        return "team_admin";
      case "MEMBER":
        return "team_member";
      case "VIEWER":
        return "team_viewer";
      default:
        return null;
    }
  }
}
