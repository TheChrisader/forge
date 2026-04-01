import type { FastifyRequest } from "fastify";
import type { PermissionsService } from "@forge/auth";
import type { PermissionCheck } from "@forge/auth";
import { requireAuth } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    permissions?: {
      check: (check: PermissionCheck) => Promise<boolean>;
      require: (check: PermissionCheck) => Promise<void>;
    };
  }
}

/**
 * Creates a permission middleware that decorates requests with permission helpers.
 *
 * Usage in route handlers:
 *   const can = await request.permissions!.require({ resource: "projects", action: "create" });
 *
 * Or use the standalone requirePermission function for simpler checks.
 */
export function setupPermissionsMiddleware(_permissionsService: PermissionsService): void {
  // This is a decorator factory — routes access permissions via request.permissions
  // The service is stored on the request during the onRequest hook below
}

/**
 * Middleware hook that attaches permission helpers to every request.
 * Call this in a Fastify onRequest hook.
 */
export function attachPermissionsToRequest(
  request: FastifyRequest,
  permissionsService: PermissionsService
): void {
  const userId = (request as { userId?: string }).userId;

  if (!userId) return;

  request.permissions = {
    check: (check: PermissionCheck): Promise<boolean> => permissionsService.check(userId, check),
    require: (check: PermissionCheck): Promise<void> => permissionsService.require(userId, check),
  };
}

/**
 * Standalone permission check — use in route handlers.
 * Requires authentication first, then checks permissions.
 *
 * @example
 * server.post("/api/projects", async (request) => {
 *   const userId = requireAuth(request.userId);
 *   await requirePermission(request, { resource: "projects", action: "create" });
 *   // ... create project
 * });
 */
export async function requirePermission(
  request: FastifyRequest,
  check: PermissionCheck
): Promise<void> {
  const userId = requireAuth((request as { userId?: string }).userId);

  const permissionsService = getPermissionsService(request);
  if (!permissionsService) {
    throw new Error(
      "Permissions middleware not initialized. Did you forget to register the AuthModule?"
    );
  }

  await permissionsService.require(userId, check);
}

/**
 * Check if the current user has a permission without throwing.
 * Returns false if not authenticated or permission is denied.
 */
export async function checkPermission(
  request: FastifyRequest,
  check: PermissionCheck
): Promise<boolean> {
  const userId = (request as { userId?: string }).userId;
  if (!userId) return false;

  const permissionsService = getPermissionsService(request);
  if (!permissionsService) return false;

  return permissionsService.check(userId, check);
}

function getPermissionsService(request: FastifyRequest): PermissionsService | null {
  try {
    const server = request.server;
    return server.permissionsService ?? null;
  } catch {
    return null;
  }
}
