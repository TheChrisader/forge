import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import type { DockerRuntime } from "@forge/docker";
import { generateImageTagPrefix } from "@forge/build";
import { getDatabaseClient } from "@forge/database";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { ProjectIdParamsSchema } from "@forge/types";

export function registerImageRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const runtime = container.resolveSync<DockerRuntime>(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME);

  /**
   * GET /api/images
   * Lists all Docker images
   */
  server.get(
    "/api/images",
    {
      schema: {
        tags: ["images"],
        querystring: z.object({
          project: z.string().optional(),
          dangling: z.coerce.boolean().optional(),
        }),
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "images", action: "read" });
      const { project, dangling } = request.query;

      let tagPrefix = "forge/";
      if (project) {
        const db = getDatabaseClient();
        const targetProject = await db.project.findUnique({
          where: { id: project },
          select: { name: true },
        });
        tagPrefix = targetProject
          ? generateImageTagPrefix(targetProject.name)
          : `forge/${project}:`;
      }

      const images = await runtime.listImages({ dangling });

      const filtered = tagPrefix
        ? images.filter((img: { repoTags?: string[] }) =>
            img.repoTags?.some((tag: string) => tag.startsWith(tagPrefix))
          )
        : images;

      return reply.send({ data: filtered });
    }
  );

  /**
   * GET /api/images/stats
   * Gets image disk usage statistics
   */
  server.get(
    "/api/images/stats",
    {
      schema: {
        tags: ["images"],
        querystring: z.object({
          project: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "images", action: "read" });
      const { project } = request.query;

      let tagPrefix = "forge/";
      if (project) {
        const db = getDatabaseClient();
        const targetProject = await db.project.findUnique({
          where: { id: project },
          select: { name: true },
        });
        tagPrefix = targetProject
          ? generateImageTagPrefix(targetProject.name)
          : `forge/${project}:`;
      }

      const stats = await runtime.getImageDiskUsage(tagPrefix);
      return reply.send({ data: stats });
    }
  );

  /**
   * DELETE /api/images/:id
   * Deletes an image
   */
  server.delete(
    "/api/images/:id",
    {
      schema: {
        tags: ["images"],
        params: z.object({
          id: z.string(),
        }),
        querystring: z.object({
          force: z.coerce.boolean().default(false),
        }),
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "images", action: "delete" });
      const { id } = request.params;
      const { force } = request.query;

      await runtime.removeImage(id, { force });
      return reply.status(204).send();
    }
  );

  /**
   * POST /api/images/prune
   * Prunes dangling images
   */
  server.post(
    "/api/images/prune",
    {
      schema: { tags: ["images"] },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "images", action: "delete" });
      const result = await runtime.pruneDanglingImages();
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/projects/:id/images/prune
   * Prunes old images for a specific project
   */
  server.post(
    "/api/projects/:projectId/images/prune",
    {
      schema: {
        tags: ["images"],
        params: ProjectIdParamsSchema,
        body: z.object({
          maxAgeDays: z.coerce.number().int().min(1).default(30),
        }),
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "images", action: "delete" });
      const { projectId } = request.params as { projectId: string };
      const { maxAgeDays } = request.body as { maxAgeDays?: number };

      const db = getDatabaseClient();
      const targetProject = await db.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });

      if (!targetProject) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const result = await runtime.pruneOldImages(
        generateImageTagPrefix(targetProject.name),
        maxAgeDays ?? 30
      );
      return reply.send({ data: result });
    }
  );
}
