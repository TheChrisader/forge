import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { SERVICE_KEY_STRINGS, BadRequestError } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { ServiceService } from "../services/service.service.js";
import {
  ServiceSchema,
  ServiceBackupSchema,
  EngineDetailSchema,
  ServiceConnectionSchema,
  ServiceWithRelationsSchema,
  ServiceFiltersSchema,
  ServiceConnectionQuerySchema,
  CreateServiceRequestSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
} from "@forge/types";
import { engineRegistry, EngineNotFoundError } from "@forge/service-catalog";

const ServiceIdParamsSchema = z.object({
  id: z.uuid(),
});

const EngineParamsSchema = z.object({
  engine: z.string(),
});

const LinkProjectParamsSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
});

const LogsQuerySchema = z.object({
  tail: z.coerce.number().int().min(1).max(10000).optional(),
});

function mapEngineToDetail(
  engine: ReturnType<typeof engineRegistry.get>
): z.infer<typeof EngineDetailSchema> {
  return {
    type: engine.type,
    engine: engine.engine,
    displayName: engine.displayName,
    description: engine.description,
    icon: engine.icon,
    supportedVersions: engine.supportedVersions,
    defaultVersion: engine.defaultVersion,
    defaultPort: engine.defaultPort,
    configParameters: engine.configParameters,
  };
}

export function registerServiceRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const serviceService = container.resolveSync<ServiceService>(SERVICE_KEY_STRINGS.SERVICE_SERVICE);

  server.get(
    "/api/services/engines",
    {
      schema: {
        tags: ["services"],
        response: {
          200: ApiResponseSchema(EngineDetailSchema.array()),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const engines = engineRegistry.listAll().map(mapEngineToDetail);
      return reply.send({ data: EngineDetailSchema.array().parse(engines) });
    }
  );

  server.get(
    "/api/services/engines/:engine/config",
    {
      schema: {
        tags: ["services"],
        params: EngineParamsSchema,
        response: {
          200: ApiResponseSchema(EngineDetailSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const { engine } = request.params as { engine: string };
      let engineDef;
      try {
        engineDef = engineRegistry.get(engine);
      } catch (err) {
        if (err instanceof EngineNotFoundError) {
          throw new BadRequestError(`Engine "${engine}" is not supported`);
        }
        throw err;
      }

      const detail = mapEngineToDetail(engineDef);
      return reply.send({ data: EngineDetailSchema.parse(detail) });
    }
  );

  server.get(
    "/api/services",
    {
      schema: {
        tags: ["services"],
        querystring: ServiceFiltersSchema,
        response: {
          200: PaginatedResponseSchema(ServiceSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const query = request.query;
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));

      const { services, total } = await serviceService.list({
        projectId: query.projectId,
        type: query.type?.[0],
        status: query.status?.[0],
        page,
        limit,
        search: query.search,
      });

      const totalPages = Math.ceil(total / limit);
      return reply.send({
        data: ServiceSchema.array().parse(services),
        meta: { total, page, limit, totalPages },
      });
    }
  );

  server.post(
    "/api/services",
    {
      schema: {
        tags: ["services"],
        body: CreateServiceRequestSchema,
        response: {
          201: ApiResponseSchema(ServiceSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "create" });

      const userId = (request as { userId?: string }).userId!;
      const body = request.body as Parameters<typeof serviceService.create>[0];

      const service = await serviceService.create(body, userId);
      return reply.status(201).send({ data: ServiceSchema.parse(service) });
    }
  );

  server.get(
    "/api/services/:id",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        response: {
          200: ApiResponseSchema(ServiceWithRelationsSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      const service = await serviceService.getById(id, userId);
      return reply.send({ data: ServiceWithRelationsSchema.parse(service) });
    }
  );

  server.get(
    "/api/services/:id/connection",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        querystring: ServiceConnectionQuerySchema,
        response: {
          200: ApiResponseSchema(ServiceConnectionSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;
      const { reveal } = request.query as { reveal: string };

      if (reveal === "true") {
        await requirePermission(request, { resource: "services", action: "admin" });
      }

      const connection = await serviceService.getConnection(id, userId, reveal === "true");
      return reply.send({ data: ServiceConnectionSchema.parse(connection) });
    }
  );

  server.post(
    "/api/services/:id/start",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        response: {
          200: ApiResponseSchema(ServiceSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      const service = await serviceService.start(id, userId);
      return reply.send({ data: ServiceSchema.parse(service) });
    }
  );

  server.post(
    "/api/services/:id/stop",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        response: {
          200: ApiResponseSchema(ServiceSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      const service = await serviceService.stop(id, userId);
      return reply.send({ data: ServiceSchema.parse(service) });
    }
  );

  server.post(
    "/api/services/:id/restart",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        response: {
          200: ApiResponseSchema(ServiceSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      const service = await serviceService.restart(id, userId);
      return reply.send({ data: ServiceSchema.parse(service) });
    }
  );

  server.delete(
    "/api/services/:id",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "delete" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      await serviceService.delete(id, userId);
      return reply.status(204).send();
    }
  );

  server.post(
    "/api/services/:id/link/:projectId",
    {
      schema: {
        tags: ["services"],
        params: LinkProjectParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id, projectId } = request.params as { id: string; projectId: string };
      const userId = (request as { userId?: string }).userId!;

      await serviceService.linkProject(id, projectId, userId);
      return reply.send({ data: { success: true } });
    }
  );

  server.delete(
    "/api/services/:id/link/:projectId",
    {
      schema: {
        tags: ["services"],
        params: LinkProjectParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id, projectId } = request.params as { id: string; projectId: string };
      const userId = (request as { userId?: string }).userId!;

      await serviceService.unlinkProject(id, projectId, userId);
      return reply.send({ data: { success: true } });
    }
  );

  server.get(
    "/api/services/:id/backups",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        response: {
          200: ApiResponseSchema(ServiceBackupSchema.array()),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      const backups = await serviceService.listBackups(id, userId);
      return reply.send({ data: ServiceBackupSchema.array().parse(backups) });
    }
  );

  server.post(
    "/api/services/:id/backups",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        response: {
          201: ApiResponseSchema(ServiceBackupSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      const backup = await serviceService.triggerBackup(id, userId);
      return reply.status(201).send({ data: ServiceBackupSchema.parse(backup) });
    }
  );

  server.post(
    "/api/services/:id/backups/:backupId/restore",
    {
      schema: {
        tags: ["services"],
        params: z.object({ id: z.uuid(), backupId: z.uuid() }),
        response: {
          200: ApiResponseSchema(ServiceBackupSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id, backupId } = request.params as { id: string; backupId: string };
      const userId = (request as { userId?: string }).userId!;

      const backup = await serviceService.restoreBackup(id, backupId, userId);
      return reply.send({ data: ServiceBackupSchema.parse(backup) });
    }
  );

  const BackupScheduleBodySchema = z.object({
    schedule: z.enum(["daily", "weekly"]).optional(),
    retention: z.number().int().min(1).max(100).optional(),
  });

  server.patch(
    "/api/services/:id/backup-schedule",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        body: BackupScheduleBodySchema,
        response: {
          200: ApiResponseSchema(ServiceSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;
      const body = request.body as { schedule?: string; retention?: number };

      const service = await serviceService.updateBackupSchedule(
        id,
        userId,
        body.schedule,
        body.retention
      );
      return reply.send({ data: ServiceSchema.parse(service) });
    }
  );

  server.get(
    "/api/services/:id/logs",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        querystring: LogsQuerySchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;
      const { tail } = request.query as { tail?: number };

      const lines = await serviceService.getLogs(id, userId, { tail });
      return reply.send({ data: { lines } });
    }
  );

  server.get(
    "/api/services/:id/stats",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "read" });

      const { id } = request.params as { id: string };
      const userId = (request as { userId?: string }).userId!;

      const stats = await serviceService.getStats(id, userId);
      return reply.send({ data: stats });
    }
  );

  const UpgradeBodySchema = z.object({
    targetVersion: z.string().max(50),
  });

  server.post(
    "/api/services/:id/upgrade",
    {
      schema: {
        tags: ["services"],
        params: ServiceIdParamsSchema,
        body: UpgradeBodySchema,
        response: {
          200: ApiResponseSchema(z.object({ jobId: z.string() })),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "services", action: "update" });

      const { id } = request.params as { id: string };
      const { targetVersion } = request.body as { targetVersion: string };
      const userId = (request as { userId?: string }).userId!;

      const result = await serviceService.upgradeService(id, targetVersion, userId);
      return reply.send({ data: result });
    }
  );

  server.get(
    "/api/services/orphans",
    {
      schema: {
        tags: ["services"],
        response: {
          200: ApiResponseSchema(
            z.object({
              orphanedContainers: z.array(z.object({ name: z.string(), serviceId: z.string() })),
              orphanedVolumes: z.array(z.object({ name: z.string(), serviceId: z.string() })),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const userId = (request as { userId?: string }).userId!;

      const orphans = await serviceService.findOrphans(userId);
      return reply.send({ data: orphans });
    }
  );

  server.post(
    "/api/services/orphans/cleanup",
    {
      schema: {
        tags: ["services"],
        response: {
          200: ApiResponseSchema(
            z.object({
              cleanedContainers: z.number(),
              cleanedVolumes: z.number(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const userId = (request as { userId?: string }).userId!;

      const result = await serviceService.cleanupOrphans(userId);
      return reply.send({ data: result });
    }
  );
}
