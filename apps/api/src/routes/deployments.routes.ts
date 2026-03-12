import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import {
  NotFoundError,
  InternalError,
  SERVICE_KEY_STRINGS,
  type BuildLogService,
} from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { DeploymentService } from "../services/deployment.service.js";
import { SSEManagerService } from "../services/sse-manager.service.js";
import { ConnectionLimitError } from "../errors/connection-limit.error.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import {
  DeploymentSchema,
  DeploymentFiltersSchema,
  IdSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
  DeploymentLogsQuerySchema,
  DeploymentLogsResponseSchema,
  DeploymentStatus,
  DeploymentStrategy,
} from "@forge/types";

const DeploymentIdParamsSchema = z.object({
  id: IdSchema,
});

const CreateDeploymentBodySchema = z.object({
  gitBranch: z.string().max(255).optional(),
  gitCommit: z
    .string()
    .regex(/^[a-f0-9]{7,40}$/i)
    .optional(),
  buildArgs: z.record(z.string(), z.string()).optional(),
});

const ProjectIdParamsSchema = z.object({
  projectId: IdSchema,
});

export function registerDeploymentRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const deploymentService = container.resolveSync<DeploymentService>(
    SERVICE_KEY_STRINGS.DEPLOYMENT_SERVICE
  );
  const buildLogService = container.resolveSync<BuildLogService>(SERVICE_KEY_STRINGS.LOG_SERVICE);
  const sseManager = container.resolveSync<SSEManagerService>(SERVICE_KEY_STRINGS.SSE_MANAGER);

  /**
   * GET /api/deployments
   * Lists all deployments with pagination and optional filtering
   */
  server.get(
    "/api/deployments",
    {
      schema: {
        querystring: DeploymentFiltersSchema,
        response: {
          200: PaginatedResponseSchema(DeploymentSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);

      const query = request.query;
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 10));

      const filters: {
        page: number;
        limit: number;
        projectId?: string;
        status?: DeploymentStatus[];
        strategy?: DeploymentStrategy[];
        search?: string;
      } = {
        page,
        limit,
      };

      if (query.status) filters.status = query.status;
      if (query.strategy) filters.strategy = query.strategy;
      if (query.search) filters.search = query.search;
      if (query.projectId) filters.projectId = query.projectId;

      const { deployments, total } = await deploymentService.list(filters);

      const totalPages = Math.ceil(total / limit);

      return reply.status(200).send({
        data: DeploymentSchema.array().parse(deployments),
        meta: { total, page, limit, totalPages },
      });
    }
  );

  /**
   * POST /api/deployments/projects/:projectId/deployments
   * Triggers a new deployment (asynchronous - returns 202)
   */
  server.post(
    "/api/deployments/projects/:projectId/deployments",
    {
      schema: {
        params: ProjectIdParamsSchema,
        body: CreateDeploymentBodySchema,
        response: {
          202: ApiResponseSchema(DeploymentSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      const params = request.params;
      const body = request.body;

      const deployment = await deploymentService.deploy(params.projectId, {
        gitBranch: body.gitBranch,
        gitCommit: body.gitCommit,
        buildArgs: body.buildArgs,
      });

      return reply.status(202).send({
        data: DeploymentSchema.parse({
          ...deployment,
          metadata: { createdBy: userId },
        }),
      });
    }
  );

  /**
   * GET /api/deployments/:id
   * Gets a single deployment by ID
   */
  server.get(
    "/api/deployments/:id",
    {
      schema: {
        params: DeploymentIdParamsSchema,
        response: {
          200: ApiResponseSchema(DeploymentSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = request.params as { id: string };

      const deployment = await deploymentService.getById(params.id);

      if (!deployment) {
        throw new NotFoundError("Deployment");
      }

      return reply.status(200).send({ data: DeploymentSchema.parse(deployment) });
    }
  );

  /**
   * POST /api/deployments/:id/cancel
   * Cancels a pending or building deployment
   */
  server.post(
    "/api/deployments/:id/cancel",
    {
      schema: {
        params: DeploymentIdParamsSchema,
        response: {
          200: ApiResponseSchema(DeploymentSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = request.params as { id: string };

      await deploymentService.cancel(params.id);
      const deployment = await deploymentService.getById(params.id);

      if (!deployment) {
        throw new NotFoundError("Deployment");
      }

      return reply.status(200).send({ data: DeploymentSchema.parse(deployment) });
    }
  );

  /**
   * GET /api/deployments/:id/logs
   * Gets deployment logs with filtering options
   */
  server.get(
    "/api/deployments/:id/logs",
    {
      schema: {
        params: DeploymentIdParamsSchema,
        querystring: DeploymentLogsQuerySchema,
        response: {
          200: DeploymentLogsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = request.params as { id: string };
      const query = DeploymentLogsQuerySchema.parse(request.query);

      try {
        let logs;
        if (query.tail) {
          logs = await buildLogService.tail(params.id, query.tail);
        } else {
          logs = await buildLogService.query({
            deploymentId: params.id,
            fromLine: query.fromLine,
            toLine: query.toLine,
            level: query.level,
            source: query.source,
            search: query.search,
          });
        }

        const total = await buildLogService.getLineCount(params.id);

        return reply.send(
          DeploymentLogsResponseSchema.parse({
            logs,
            total,
            metadata: {
              fromLine: logs[0]?.lineNumber ?? 0,
              toLine: logs[logs.length - 1]?.lineNumber ?? 0,
              count: logs.length,
            },
          })
        );
      } catch (error) {
        server.log.error({ error, deploymentId: params.id }, "Failed to fetch deployment logs");
        throw new InternalError("Failed to fetch deployment logs");
      }
    }
  );

  /**
   * GET /api/deployments/:id/logs/export
   * Exports deployment logs as a plain text file
   */
  server.get(
    "/api/deployments/:id/logs/export",
    {
      schema: {
        params: DeploymentIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = request.params as { id: string };

      try {
        const logs = await buildLogService.query({
          deploymentId: params.id,
          limit: 100_000, // max 100k lines
        });

        const content = logs
          .map(
            (l: { timestamp: Date; level: string; source: string; message: string }) =>
              `[${l.timestamp.toISOString()}] [${l.level}] [${l.source}] ${l.message}`
          )
          .join("\n");

        reply.header("Content-Disposition", `attachment; filename="deployment-${params.id}.log"`);
        reply.type("text/plain");
        return reply.send(content);
      } catch (error) {
        server.log.error({ error, deploymentId: params.id }, "Failed to export deployment logs");
        throw new InternalError("Failed to export deployment logs");
      }
    }
  );

  /**
   * GET /api/deployments/:id/logs/stream
   * Server-Sent Events endpoint for real-time deployment log streaming
   *
   * This endpoint establishes an SSE connection and streams logs as they're
   * emitted by the builder worker via BullMQ progress events.
   */
  server.get(
    "/api/deployments/:id/logs/stream",
    {
      sse: true, // Enable @fastify/sse plugin for this route
      schema: {
        params: DeploymentIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = DeploymentIdParamsSchema.parse(request.params);

      const deployment = await deploymentService.getById(params.id);
      if (!deployment) {
        throw new NotFoundError("Deployment");
      }

      await reply.sse.send({
        event: "connected",
        data: { deploymentId: params.id, timestamp: new Date().toISOString() },
      });

      // Wrap subscribe in try/catch to handle connection limit errors
      try {
        sseManager.subscribe(`deployment:${params.id}`, reply);
      } catch (error) {
        if (error instanceof ConnectionLimitError) {
          // Send error event before closing
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
          // Close the connection
          reply.sse.close();
          return;
        }
        throw error;
      }

      reply.sse.onClose(() => {
        sseManager.unsubscribe(`deployment:${params.id}`, reply);
      });

      reply.sse.keepAlive();
    }
  );
}
