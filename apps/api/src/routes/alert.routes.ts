import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { AlertService } from "../services/alert.service.js";
import {
  AlertSchema,
  AlertFiltersSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
} from "@forge/types";

const AlertIdParamsSchema = z.object({
  id: z.uuid(),
});

export function registerAlertRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const alertService = container.resolveSync<AlertService>(SERVICE_KEY_STRINGS.ALERT_SERVICE);

  server.get(
    "/api/alerts",
    {
      schema: {
        tags: ["alerts"],
        querystring: AlertFiltersSchema,
        response: {
          200: PaginatedResponseSchema(AlertSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "read" });

      const query = request.query;
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));

      const { alerts, total } = await alertService.list({
        page,
        limit,
        projectId: query.projectId,
        status: query.status,
        severity: query.severity,
      });

      const totalPages = Math.ceil(total / limit);
      return reply.send({
        data: AlertSchema.array().parse(alerts),
        meta: { total, page, limit, totalPages },
      });
    }
  );

  server.get(
    "/api/alerts/:id",
    {
      schema: {
        tags: ["alerts"],
        params: AlertIdParamsSchema,
        response: {
          200: ApiResponseSchema(AlertSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "read" });

      const { id } = request.params as { id: string };
      const alert = await alertService.getById(id);
      return reply.send({ data: AlertSchema.parse(alert) });
    }
  );

  server.post(
    "/api/alerts/:id/acknowledge",
    {
      schema: {
        tags: ["alerts"],
        params: AlertIdParamsSchema,
        response: {
          200: ApiResponseSchema(AlertSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "update" });

      const { id } = request.params as { id: string };
      const alert = await alertService.acknowledge(id, userId);
      return reply.send({ data: AlertSchema.parse(alert) });
    }
  );

  server.post(
    "/api/alerts/:id/resolve",
    {
      schema: {
        tags: ["alerts"],
        params: AlertIdParamsSchema,
        response: {
          200: ApiResponseSchema(AlertSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "update" });

      const { id } = request.params as { id: string };
      const alert = await alertService.resolve(id);
      return reply.send({ data: AlertSchema.parse(alert) });
    }
  );
}
