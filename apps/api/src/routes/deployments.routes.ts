import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { NotFoundError, SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { DeploymentService } from "../services/deployment.service.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import {
  DeploymentSchema,
  DeploymentFiltersSchema,
  IdSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
} from "@forge/types";

const DeploymentIdParamsSchema = z.object({
  id: IdSchema,
});

const CreateDeploymentBodySchema = z.object({
  version: z.string().optional(),
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

      const { projectId, status, page = 1, limit = 10 } = request.query;

      const { deployments, total } = await deploymentService.list({
        projectId,
        status,
        page,
        limit,
      });

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
      const params = request.params as { projectId: string };
      const body = request.body as { version?: string };

      const deployment = await deploymentService.deploy(params.projectId, body.version);

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
   * Gets deployment logs (stub for now)
   */
  server.get(
    "/api/deployments/:id/logs",
    {
      schema: {
        params: DeploymentIdParamsSchema,
        response: {
          200: ApiResponseSchema(
            z.object({
              logs: z.string(),
            })
          ),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = request.params as { id: string };

      const logs = await deploymentService.getLogs(params.id);

      return reply.status(200).send({ data: { logs } });
    }
  );
}
