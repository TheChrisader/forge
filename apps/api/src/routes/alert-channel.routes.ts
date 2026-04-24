import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { AlertChannelService } from "../services/alert-channel.service.js";
import { createNotificationProvider } from "@forge/integrations";
import {
  AlertChannelSchema,
  AlertChannelFiltersSchema,
  CreateAlertChannelRequestSchema,
  UpdateAlertChannelRequestSchema,
  CreateAlertChannelRuleRequestSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
} from "@forge/types";

const ChannelIdParamsSchema = z.object({
  id: z.uuid(),
});

const ChannelRuleParamsSchema = z.object({
  channelId: z.uuid(),
  ruleId: z.uuid(),
});

export function registerAlertChannelRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const channelService = container.resolveSync<AlertChannelService>(
    SERVICE_KEY_STRINGS.ALERT_CHANNEL_SERVICE
  );

  server.get(
    "/api/alert-channels",
    {
      schema: {
        querystring: AlertChannelFiltersSchema,
        response: {
          200: PaginatedResponseSchema(AlertChannelSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "read" });

      const query = request.query;
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));

      const { channels, total } = await channelService.list({
        page,
        limit,
        projectId: query.projectId,
        type: query.type,
      });

      const totalPages = Math.ceil(total / limit);
      return reply.send({
        data: AlertChannelSchema.array().parse(channels),
        meta: { total, page, limit, totalPages },
      });
    }
  );

  server.get(
    "/api/alert-channels/:id",
    {
      schema: {
        params: ChannelIdParamsSchema,
        response: {
          200: ApiResponseSchema(AlertChannelSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "read" });

      const { id } = request.params as { id: string };
      const channel = await channelService.getById(id);
      return reply.send({ data: AlertChannelSchema.parse(channel) });
    }
  );

  server.post(
    "/api/alert-channels",
    {
      schema: {
        body: CreateAlertChannelRequestSchema,
        response: {
          201: ApiResponseSchema(AlertChannelSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "create" });

      const body = request.body;
      const channel = await channelService.create(body);
      return reply.status(201).send({ data: AlertChannelSchema.parse(channel) });
    }
  );

  server.patch(
    "/api/alert-channels/:id",
    {
      schema: {
        params: ChannelIdParamsSchema,
        body: UpdateAlertChannelRequestSchema,
        response: {
          200: ApiResponseSchema(AlertChannelSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "update" });

      const { id } = request.params as { id: string };
      const body = request.body;
      const channel = await channelService.update(id, body);
      return reply.send({ data: AlertChannelSchema.parse(channel) });
    }
  );

  server.delete(
    "/api/alert-channels/:id",
    {
      schema: {
        params: ChannelIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "delete" });

      const { id } = request.params as { id: string };
      await channelService.delete(id);
      return reply.status(204).send();
    }
  );

  server.post(
    "/api/alert-channels/:id/rules",
    {
      schema: {
        params: ChannelIdParamsSchema,
        body: CreateAlertChannelRuleRequestSchema,
        response: {
          201: ApiResponseSchema(z.object({ id: z.string().uuid() })),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "update" });

      const { id } = request.params as { id: string };
      const body = request.body;
      const link = await channelService.addRule(id, body.ruleId, body.severities);
      return reply.status(201).send({ data: link });
    }
  );

  server.delete(
    "/api/alert-channels/:channelId/rules/:ruleId",
    {
      schema: {
        params: ChannelRuleParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "update" });

      const { channelId, ruleId } = request.params as { channelId: string; ruleId: string };
      await channelService.removeRule(channelId, ruleId);
      return reply.status(204).send();
    }
  );

  server.post(
    "/api/alert-channels/:id/test",
    {
      schema: {
        params: ChannelIdParamsSchema,
        response: {
          200: ApiResponseSchema(z.object({ success: z.boolean(), error: z.string().optional() })),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "alerts", action: "update" });

      const { id } = request.params as { id: string };
      const channel = await channelService.getById(id);

      try {
        const provider = createNotificationProvider(
          channel.type as string,
          channel.config as Record<string, unknown>
        );
        const result = await provider.test();
        return reply.send({ data: result });
      } catch (err) {
        return reply.send({
          data: {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
  );
}
