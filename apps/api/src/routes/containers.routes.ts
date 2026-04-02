import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { SERVICE_KEY_STRINGS, NotFoundError } from "@forge/core";
import type { IContainerService } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { ConnectionLimitError } from "../errors/connection-limit.error.js";
import { SSEManagerService } from "../services/sse-manager.service.js";
import { ProjectIdParamsSchema } from "@forge/types";

const ContainerIdParamsSchema = z.object({
  id: z.uuid(),
});

const DeploymentIdParamsSchema = z.object({
  deploymentId: z.uuid(),
});

const ContainerStopQuerySchema = z.object({
  timeout: z.coerce.number().int().min(0).max(300).optional(),
});

const ContainerRemoveQuerySchema = z.object({
  force: z.coerce.boolean().default(false),
});

const ContainerLogsQuerySchema = z.object({
  tail: z.union([z.coerce.number().int().min(1), z.literal("all")]).optional(),
  follow: z.coerce.boolean().default(false),
  stdout: z.coerce.boolean().default(true),
  stderr: z.coerce.boolean().default(true),
});

const ContainerExecBodySchema = z.object({
  command: z.array(z.string()).min(1),
});

export function registerContainerRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const registry = server.registry.getContainer();
  const containerService = registry.resolveSync<IContainerService>(
    SERVICE_KEY_STRINGS.CONTAINER_SERVICE
  );
  const sseManager = registry.resolveSync<SSEManagerService>(SERVICE_KEY_STRINGS.SSE_MANAGER);

  /**
   * GET /api/projects/:projectId/containers
   * Lists all containers for a project
   */
  server.get(
    "/api/projects/:projectId/containers",
    {
      schema: {
        params: ProjectIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "read" });
      const { projectId } = request.params as { projectId: string };

      const containers = await containerService.getByProject(projectId);
      return reply.send({ data: containers });
    }
  );

  /**
   * GET /api/deployments/:deploymentId/containers
   * Lists all containers for a deployment
   */
  server.get(
    "/api/deployments/:deploymentId/containers",
    {
      schema: {
        params: DeploymentIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "read" });
      const { deploymentId } = request.params as { deploymentId: string };

      const containers = await containerService.getByDeployment(deploymentId);
      return reply.send({ data: containers });
    }
  );

  /**
   * GET /api/containers/:id
   * Gets detailed information about a single container
   */
  server.get(
    "/api/containers/:id",
    {
      schema: {
        params: ContainerIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "read" });
      const { id } = request.params as { id: string };

      const container = await containerService.getById(id);
      if (!container) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Container with ID ${id} not found`,
        });
      }

      return reply.send({ data: container });
    }
  );

  /**
   * POST /api/containers/:id/start
   * Starts a container
   */
  server.post(
    "/api/containers/:id/start",
    {
      schema: {
        params: ContainerIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "update" });
      const { id } = request.params as { id: string };

      await containerService.start(id);
      return reply.status(204).send();
    }
  );

  /**
   * POST /api/containers/:id/stop
   * Stops a container with optional timeout
   */
  server.post(
    "/api/containers/:id/stop",
    {
      schema: {
        params: ContainerIdParamsSchema,
        querystring: ContainerStopQuerySchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "update" });
      const { id } = request.params as { id: string };
      const { timeout } = request.query as { timeout?: number };

      await containerService.stop(id, timeout);
      return reply.status(204).send();
    }
  );

  /**
   * POST /api/containers/:id/restart
   * Restarts a container
   */
  server.post(
    "/api/containers/:id/restart",
    {
      schema: {
        params: ContainerIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "update" });
      const { id } = request.params as { id: string };

      await containerService.restart(id);
      return reply.status(204).send();
    }
  );

  /**
   * DELETE /api/containers/:id
   * Removes a container with optional force
   */
  server.delete(
    "/api/containers/:id",
    {
      schema: {
        params: ContainerIdParamsSchema,
        querystring: ContainerRemoveQuerySchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "delete" });
      const { id } = request.params as { id: string };
      const { force } = request.query as { force: boolean };

      await containerService.remove(id, force);
      return reply.status(204).send();
    }
  );

  /**
   * GET /api/containers/:id/logs
   * Gets logs from a container
   */
  server.get(
    "/api/containers/:id/logs",
    {
      schema: {
        params: ContainerIdParamsSchema,
        querystring: ContainerLogsQuerySchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "read" });
      const { id } = request.params as { id: string };
      const { tail, follow, stdout, stderr } = request.query as {
        tail?: number | "all";
        follow?: boolean;
        stdout?: boolean;
        stderr?: boolean;
      };

      const logs = await containerService.getLogs(id, {
        tail,
        follow,
        stdout,
        stderr,
      });

      return reply.send({ data: logs });
    }
  );

  /**
   * GET /api/containers/:id/logs/stream
   * Server-Sent Events endpoint for real-time container log streaming
   */
  server.get(
    "/api/containers/:id/logs/stream",
    {
      sse: true,
      schema: {
        params: ContainerIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "read" });
      const params = ContainerIdParamsSchema.parse(request.params);

      const container = await containerService.getById(params.id);
      if (!container) {
        throw new NotFoundError("Container");
      }

      await reply.sse.send({
        event: "connected",
        data: { containerId: params.id, timestamp: new Date().toISOString() },
      });

      try {
        sseManager.subscribe(`container:${params.id}`, reply);
      } catch (error) {
        if (error instanceof ConnectionLimitError) {
          await reply.sse.send({
            event: "error",
            data: {
              code: "CONNECTION_LIMIT_REACHED",
              message: error.message,
              type: error.type,
              limit: error.limit,
              current: error.current,
            },
          });
          reply.sse.close();
          return;
        }
        throw error;
      }

      reply.sse.onClose(() => {
        sseManager.unsubscribe(`container:${params.id}`, reply);
      });

      reply.sse.keepAlive();

      // Delegate to service for domain logic
      await containerService.streamLogs(params.id);
    }
  );

  /**
   * GET /api/containers/:id/stats
   * Gets resource usage statistics for a container
   */
  server.get(
    "/api/containers/:id/stats",
    {
      schema: {
        params: ContainerIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "read" });
      const { id } = request.params as { id: string };

      const stats = await containerService.getStats(id);
      return reply.send({ data: stats });
    }
  );

  /**
   * POST /api/containers/:id/exec
   * Executes a command in a container
   */
  server.post(
    "/api/containers/:id/exec",
    {
      schema: {
        params: ContainerIdParamsSchema,
        body: ContainerExecBodySchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "containers", action: "update" });
      const { id } = request.params as { id: string };
      const { command } = request.body as { command: string[] };

      const result = await containerService.exec(id, command);
      return reply.send({ data: result });
    }
  );
}
