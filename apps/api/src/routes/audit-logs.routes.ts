import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogService } from "../services/audit-log.service.js";
import { AuditLogQuerySchema } from "@forge/types";

export function registerAuditLogRoutes(server: FastifyInstance): void {
  const db = (server as { db: unknown }).db as import("@forge/database").PrismaClient;
  const auditLogService = new AuditLogService(db);

  server.get(
    "/api/audit-logs",
    {
      schema: {
        tags: ["audit-logs"],
        querystring: AuditLogQuerySchema,
      },
    },
    async (request) => {
      requireAuth((request as { userId?: string }).userId);

      const params = AuditLogQuerySchema.parse(request.query);
      // @ts-expect-error Type 'AuditLogQueryParams' is not assignable to type 'AuditLogQueryParams'
      const result = await auditLogService.query(params);

      return {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    }
  );
}
