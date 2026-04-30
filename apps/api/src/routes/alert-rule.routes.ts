import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { AlertRuleService } from "../services/alert-rule.service.js";
import {
  AlertRuleSchema,
  AlertRuleFiltersSchema,
  CreateAlertRuleRequestSchema,
  UpdateAlertRuleRequestSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
} from "@forge/types";

const RuleIdParamsSchema = z.object({
  id: z.uuid(),
});

export function registerAlertRuleRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const ruleService = container.resolveSync<AlertRuleService>(
    SERVICE_KEY_STRINGS.ALERT_RULE_SERVICE
  );

  server.get(
    "/api/alert-rules",
    {
      schema: {
        tags: ["alerts"],
        querystring: AlertRuleFiltersSchema,
        response: {
          200: PaginatedResponseSchema(AlertRuleSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "read" });

      const query = request.query;
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));

      const { rules, total } = await ruleService.list({
        page,
        limit,
        projectId: query.projectId,
        enabled: query.enabled,
        severity: query.severity,
      });

      const totalPages = Math.ceil(total / limit);
      return reply.send({
        data: AlertRuleSchema.array().parse(rules),
        meta: { total, page, limit, totalPages },
      });
    }
  );

  server.get(
    "/api/alert-rules/:id",
    {
      schema: {
        tags: ["alerts"],
        params: RuleIdParamsSchema,
        response: {
          200: ApiResponseSchema(AlertRuleSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "read" });

      const { id } = request.params as { id: string };
      const rule = await ruleService.getById(id);
      return reply.send({ data: AlertRuleSchema.parse(rule) });
    }
  );

  server.post(
    "/api/alert-rules",
    {
      schema: {
        tags: ["alerts"],
        body: CreateAlertRuleRequestSchema,
        response: {
          201: ApiResponseSchema(AlertRuleSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "create" });

      const body = request.body;
      const rule = await ruleService.create(body, userId);
      return reply.status(201).send({ data: AlertRuleSchema.parse(rule) });
    }
  );

  server.patch(
    "/api/alert-rules/:id",
    {
      schema: {
        tags: ["alerts"],
        params: RuleIdParamsSchema,
        body: UpdateAlertRuleRequestSchema,
        response: {
          200: ApiResponseSchema(AlertRuleSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "update" });

      const { id } = request.params as { id: string };
      const body = request.body;
      const rule = await ruleService.update(id, body);
      return reply.send({ data: AlertRuleSchema.parse(rule) });
    }
  );

  server.delete(
    "/api/alert-rules/:id",
    {
      schema: {
        tags: ["alerts"],
        params: RuleIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "delete" });

      const { id } = request.params as { id: string };
      await ruleService.delete(id);
      return reply.status(204).send();
    }
  );
}
