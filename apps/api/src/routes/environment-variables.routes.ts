import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { EnvironmentVariableService } from "../services/environment-variable.service.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import {
  UpsertEnvVarsRequestSchema,
  EnvironmentVariableResponseSchema,
  ResolvedEnvVarsResponseSchema,
  ProjectIdParamsSchema,
  EnvVarDeleteParamsSchema,
  EnvVarListQuerySchema,
} from "@forge/types";
import { ApiResponseSchema } from "@forge/types";

export function registerEnvironmentVariableRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const envVarService = container.resolveSync<EnvironmentVariableService>(
    SERVICE_KEY_STRINGS.ENVIRONMENT_VARIABLE_SERVICE
  );

  /**
   * GET /api/projects/:projectId/environment-variables
   * Lists all environment variables for a project
   */
  server.get(
    "/api/projects/:projectId/environment-variables",
    {
      schema: {
        tags: ["environment"],
        params: ProjectIdParamsSchema,
        querystring: EnvVarListQuerySchema,
        response: {
          200: ApiResponseSchema(EnvironmentVariableResponseSchema.array()),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "read" });
      const { projectId } = request.params;
      const { environmentId } = request.query;

      const envVars = await envVarService.list(projectId, environmentId);

      return reply.status(200).send({ data: envVars });
    }
  );

  /**
   * GET /api/projects/:projectId/environment-variables/resolved
   * Returns merged project-level + environment-specific environment variables
   */
  server.get(
    "/api/projects/:projectId/environment-variables/resolved",
    {
      schema: {
        tags: ["environment"],
        params: ProjectIdParamsSchema,
        querystring: EnvVarListQuerySchema,
        response: {
          200: ApiResponseSchema(ResolvedEnvVarsResponseSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "read" });
      const { projectId } = request.params;
      const { environmentId } = request.query;

      const resolved = await envVarService.getResolvedEnv(projectId, environmentId);

      return reply.status(200).send({ data: resolved });
    }
  );

  /**
   * PUT /api/projects/:projectId/environment-variables
   * Batch upserts environment variables for a given scope
   */
  server.put(
    "/api/projects/:projectId/environment-variables",
    {
      schema: {
        tags: ["environment"],
        params: ProjectIdParamsSchema,
        body: UpsertEnvVarsRequestSchema,
        response: {
          200: ApiResponseSchema(EnvironmentVariableResponseSchema.array()),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { projectId } = request.params;
      const { environmentId, variables } = request.body;

      await envVarService.upsert(projectId, environmentId ?? null, variables);

      const envVars = await envVarService.list(projectId, environmentId ?? undefined);

      return reply.status(200).send({ data: envVars });
    }
  );

  /**
   * DELETE /api/projects/:projectId/environment-variables/:key
   * Deletes a single environment variable
   */
  server.delete(
    "/api/projects/:projectId/environment-variables/:key",
    {
      schema: {
        tags: ["environment"],
        params: EnvVarDeleteParamsSchema,
        querystring: EnvVarListQuerySchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { projectId, key } = request.params;
      const { environmentId } = request.query;

      await envVarService.delete(projectId, environmentId ?? null, key);

      return reply.status(204).send();
    }
  );
}
