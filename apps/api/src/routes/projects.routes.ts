import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { NotFoundError, SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { ProjectService } from "../services/project.service.js";
import type { BuildCacheService } from "@forge/docker";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  ProjectSchema,
  ProjectIdParamsSchema,
  ProjectStatus,
} from "@forge/types";
import {
  ApiResponseSchema,
  PaginatedResponseSchema,
  ProjectListQuerySchema,
  CacheStatsSchema,
  CacheClearResultSchema,
} from "@forge/types";

const ProjectIncludeQuerySchema = z.object({
  include: z.array(z.enum(["gitIntegration", "deployments", "containers"])).optional(),
});

export function registerProjectRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const projectService = container.resolveSync<ProjectService>(SERVICE_KEY_STRINGS.PROJECT_SERVICE);

  /**
   * GET /api/projects
   * Lists all projects with pagination and optional filtering
   */
  server.get(
    "/api/projects",
    {
      schema: {
        tags: ["projects"],
        querystring: ProjectListQuerySchema,
        response: {
          200: PaginatedResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "read" });

      const userId = (request as { userId?: string }).userId!;
      const db = server.db;

      const userWithRoles = await db.user.findUnique({
        where: { id: userId },
        select: {
          roleAssignments: {
            select: { role: { select: { isSystem: true, name: true } } },
          },
        },
      });

      const isPlatformAdmin = userWithRoles?.roleAssignments.some(
        (ra) => ra.role.isSystem && ra.role.name === "platform_admin"
      );

      let teamIds: string[] | undefined;
      if (!isPlatformAdmin) {
        const userTeams = await db.teamMember.findMany({
          where: { userId },
          select: { teamId: true },
        });
        teamIds = userTeams.map((m) => m.teamId);
      }

      const query = request.query;
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 10));

      const filters: {
        page: number;
        limit: number;
        status?: ProjectStatus[];
      } = {
        page,
        limit,
      };

      if (query.status) {
        filters.status = query.status;
      }

      const { projects, total } = await projectService.list({ ...filters, teamIds });
      const totalPages = Math.ceil(total / limit);

      return reply.status(200).send({
        data: ProjectSchema.array().parse(projects),
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    }
  );

  /**
   * POST /api/projects
   * Creates a new project
   */
  server.post(
    "/api/projects",
    {
      schema: {
        tags: ["projects"],
        body: CreateProjectRequestSchema,
        response: {
          201: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "create" });
      const body = request.body;

      const project = await projectService.create({
        ...body,
        metadata: { ...body.metadata, createdBy: userId },
      });

      return reply.status(201).send({ data: ProjectSchema.parse(project) });
    }
  );

  /**
   * GET /api/projects/:projectId
   * Gets a single project by ID with optional included relations
   */
  server.get<{
    Params: { projectId: string };
    Querystring: z.infer<typeof ProjectIncludeQuerySchema>;
  }>(
    "/api/projects/:projectId",
    {
      schema: {
        tags: ["projects"],
        params: ProjectIdParamsSchema,
        querystring: ProjectIncludeQuerySchema,
        response: {
          200: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "read" });
      const params = request.params;
      const query = request.query ?? {};

      const project = await projectService.getById(params.projectId, { include: query.include });

      if (!project) {
        throw new NotFoundError("Project");
      }

      return reply.status(200).send({ data: project });
    }
  );

  /**
   * PUT /api/projects/:id
   * Updates a project (full update - replaces all fields)
   */
  server.put(
    "/api/projects/:projectId",
    {
      schema: {
        tags: ["projects"],
        params: ProjectIdParamsSchema,
        body: UpdateProjectRequestSchema,
        response: {
          200: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const params = request.params;
      const body = request.body;

      if (Object.keys(body).length === 0) {
        throw new NotFoundError("At least one field must be provided for update");
      }

      const project = await projectService.update(params.projectId, {
        ...body,
        metadata: { ...(body.metadata ?? {}), updatedBy: userId },
      });

      return reply.status(200).send({ data: ProjectSchema.parse(project) });
    }
  );

  /**
   * PATCH /api/projects/:id
   * Updates a project (partial update - only provided fields)
   */
  server.patch(
    "/api/projects/:projectId",
    {
      schema: {
        tags: ["projects"],
        params: ProjectIdParamsSchema,
        body: UpdateProjectRequestSchema,
        response: {
          200: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const params = request.params;
      const body = request.body;

      if (Object.keys(body).length === 0) {
        throw new NotFoundError("At least one field must be provided for update");
      }

      const project = await projectService.update(params.projectId, {
        ...body,
        metadata: { ...(body.metadata ?? {}), updatedBy: userId },
      });

      return reply.status(200).send({ data: ProjectSchema.parse(project) });
    }
  );

  /**
   * POST /api/projects/:projectId/stop
   * Stops all running resources for a project
   */
  server.post(
    "/api/projects/:projectId/stop",
    {
      schema: {
        tags: ["projects"],
        params: ProjectIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const params = request.params;

      await projectService.stop(params.projectId);

      return reply.status(200).send({ data: { stopped: true } });
    }
  );

  /**
   * DELETE /api/projects/:id
   * Deletes a project
   */
  server.delete(
    "/api/projects/:projectId",
    {
      schema: {
        tags: ["projects"],
        params: ProjectIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "delete" });
      const params = request.params;

      await projectService.delete(params.projectId);

      return reply.status(204).send();
    }
  );

  /**
   * GET /api/projects/:id/cache
   * Gets build cache statistics for a project
   */
  server.get(
    "/api/projects/:id/cache",
    {
      schema: {
        tags: ["projects"],
        params: ProjectIdParamsSchema,
        response: {
          200: ApiResponseSchema(CacheStatsSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "read" });
      const params = request.params;

      const project = await projectService.getById(params.projectId);

      if (!project) {
        throw new NotFoundError("Project");
      }

      const cacheService = container.resolveSync<BuildCacheService>(
        SERVICE_KEY_STRINGS.BUILD_CACHE_SERVICE
      );
      const stats = await cacheService.getCacheStats(params.projectId);

      return reply.status(200).send({ data: stats });
    }
  );

  /**
   * DELETE /api/projects/:id/cache
   * Clears build cache for a project
   */
  server.delete(
    "/api/projects/:id/cache",
    {
      schema: {
        tags: ["projects"],
        params: ProjectIdParamsSchema,
        response: {
          200: ApiResponseSchema(CacheClearResultSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "delete" });
      const params = request.params;

      const project = await projectService.getById(params.projectId);

      if (!project) {
        throw new NotFoundError("Project");
      }

      const cacheService = container.resolveSync<BuildCacheService>(
        SERVICE_KEY_STRINGS.BUILD_CACHE_SERVICE
      );
      const result = await cacheService.clearCache(params.projectId);

      return reply.status(200).send({ data: result });
    }
  );
}
