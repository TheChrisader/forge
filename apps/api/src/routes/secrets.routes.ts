import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { SERVICE_KEY_STRINGS, NotFoundError } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { SecretService } from "../services/secret.service.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import {
  CreateSecretRequestSchema,
  UpdateSecretRequestSchema,
  SecretResponseSchema,
  SecretIdParamsSchema,
  ProjectIdParamsSchema,
} from "@forge/types";
import { ApiResponseSchema } from "@forge/types";

export function registerSecretRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const secretService = container.resolveSync<SecretService>(SERVICE_KEY_STRINGS.SECRET_SERVICE);

  /**
   * GET /api/projects/:projectId/secrets
   * Lists all secrets for a project (keys only, no values)
   */
  server.get(
    "/api/projects/:projectId/secrets",
    {
      schema: {
        tags: ["secrets"],
        params: ProjectIdParamsSchema,
        response: {
          200: ApiResponseSchema(SecretResponseSchema.array()),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "read" });
      const { projectId } = request.params;

      const secrets = await secretService.list(projectId);

      return reply.status(200).send({ data: secrets });
    }
  );

  /**
   * POST /api/projects/:projectId/secrets
   * Creates a new secret
   */
  server.post(
    "/api/projects/:projectId/secrets",
    {
      schema: {
        tags: ["secrets"],
        params: ProjectIdParamsSchema,
        body: CreateSecretRequestSchema,
        response: {
          201: ApiResponseSchema(SecretResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { projectId } = request.params;
      const body = request.body;

      const secret = await secretService.create({
        projectId,
        key: body.key,
        value: body.value,
        description: body.description,
        createdBy: userId,
      });

      return reply.status(201).send({ data: secret });
    }
  );

  /**
   * PUT /api/projects/:projectId/secrets/:id
   * Updates a secret's value
   */
  server.put(
    "/api/projects/:projectId/secrets/:id",
    {
      schema: {
        tags: ["secrets"],
        params: SecretIdParamsSchema,
        body: UpdateSecretRequestSchema,
        response: {
          200: ApiResponseSchema(SecretResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { id } = request.params;
      const body = request.body;

      await secretService.update(id, body.value, userId);

      // Fetch the updated record to return
      const secrets = await secretService.list();
      const updated = secrets.find((s) => s.id === id);

      if (!updated) {
        throw new NotFoundError("Secret");
      }

      return reply.status(200).send({ data: updated });
    }
  );

  /**
   * DELETE /api/projects/:projectId/secrets/:id
   * Soft-deletes a secret
   */
  server.delete(
    "/api/projects/:projectId/secrets/:id",
    {
      schema: {
        tags: ["secrets"],
        params: SecretIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { id } = request.params;

      await secretService.delete(id);

      return reply.status(204).send();
    }
  );
}
