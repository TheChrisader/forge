import type { FastifyInstance } from "fastify";

const AUDITABLE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const EXCLUDED_ROUTES = ["/api/health", "/api/auth/login", "/api/auth/refresh"];

const METHOD_TO_ACTION: Record<string, string> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/**
 * Derives a resource type from the route path.
 * The resource type is always the last meaningful path segment,
 * ignoring any UUID-like path parameters.
 *
 * @param path - The route URL path (e.g., "/api/projects/abc-123")
 * @returns A lowercase plural resource name
 */
function deriveResourceType(path: string): string {
  const withoutPrefix = path.replace(/^\/api\//, "");
  const segments = withoutPrefix.split("/").filter(Boolean);

  if (segments.length === 0) {
    return "unknown";
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);

    if (!isUuid) {
      return segment.toLowerCase();
    }
  }

  return "unknown";
}

/**
 * Derives an action string from the HTTP method and resource type.
 *
 * @param method - HTTP method (POST, PUT, PATCH, DELETE)
 * @param path - The route URL path
 * @returns A dotted action string (resourceType.verb)
 */
function deriveAction(method: string, path: string): string {
  const resourceType = deriveResourceType(path);
  const verb = METHOD_TO_ACTION[method] ?? method.toLowerCase();
  return `${resourceType}.${verb}`;
}

/**
 * Extracts a resource ID from the route path.
 *
 * Looks for UUID segments in the URL path. If found, returns the first one.
 * Returns null for collection-level operations (e.g., POST /api/projects).
 *
 * @param path - The route URL path (e.g., "/api/projects/abc-123")
 * @returns A UUID string or null
 */
function extractResourceId(path: string): string | null {
  const segments = path.split("/").filter(Boolean);

  for (const segment of segments) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      return segment;
    }
  }

  return null;
}

/**
 * Determines whether a given route should be audit-logged.
 *
 * @param method - HTTP method
 * @param path - Route URL path
 * @returns True if the route is an auditable mutation
 */
function isAuditableRoute(method: string, path: string): boolean {
  if (!AUDITABLE_METHODS.has(method)) {
    return false;
  }

  const normalizedPath = path.split("?")[0];

  for (const excluded of EXCLUDED_ROUTES) {
    if (normalizedPath === excluded || normalizedPath.startsWith(excluded + "/")) {
      return false;
    }
  }

  return normalizedPath.startsWith("/api/");
}

/**
 * Sets up audit logging for all significant mutating API requests.
 *
 * Uses an `onSend` hook so the audit entry is written only after
 * the handler has successfully produced a response. Audit failures
 * are caught and logged but never propagate to the client, ensuring
 * that a broken audit trail never blocks legitimate requests.
 *
 * @param server - The Fastify instance with decorated `db` (PrismaClient) and `logger`
 */
export function setupAuditLogging(server: FastifyInstance): void {
  const db = server.db;

  server.addHook("onSend", async (request, _reply) => {
    if (!isAuditableRoute(request.method, request.url)) {
      return;
    }

    const userId: string | undefined = request.userId;
    const normalizedPath = request.url.split("?")[0];

    // Look up the user's email if we have a userId.
    // This is best-effort: if the lookup fails, we still log without an email.
    let userEmail: string | null = null;
    if (userId) {
      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (user) {
          userEmail = user.email;
        }
      } catch {
        // Intentionally swallowed -- a missing email should not break the audit write.
      }
    }

    const action = deriveAction(request.method, normalizedPath);
    const resourceType = deriveResourceType(normalizedPath);
    const resourceId = extractResourceId(normalizedPath);

    try {
      await db.auditLog.create({
        data: {
          userId: userId ?? null,
          userEmail: userEmail,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
          action,
          resourceType,
          resourceId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      // Audit logging must never break a request. Log the failure and move on.
      server.logger.error("Failed to write audit log entry", {
        err: error,
        action,
        resourceType,
        resourceId,
        userId: userId ?? "anonymous",
        path: normalizedPath,
        method: request.method,
      });
    }
  });
}
