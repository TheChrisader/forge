import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { NotFoundError, SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { ProjectService } from "../services/project.service.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  ProjectSchema,
  ProjectIdParamsSchema,
  ProjectStatus,
} from "@forge/types";
import { ApiResponseSchema, PaginatedResponseSchema, ProjectListQuerySchema } from "@forge/types";

// =============================================================================
// Routes
// =============================================================================

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
        querystring: ProjectListQuerySchema,
        response: {
          200: PaginatedResponseSchema(ProjectSchema),
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
        status?: ProjectStatus[];
      } = {
        page,
        limit,
      };

      if (query.status) {
        filters.status = query.status;
      }

      const { projects, total } = await projectService.list(filters);
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
        body: CreateProjectRequestSchema,
        response: {
          201: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      const body = request.body;

      const project = await projectService.create({
        ...body,
        metadata: { ...body.metadata, createdBy: userId },
      });

      return reply.status(201).send({ data: ProjectSchema.parse(project) });
    }
  );

  /**
   * GET /api/projects/:id
   * Gets a single project by ID
   */
  server.get(
    "/api/projects/:id",
    {
      schema: {
        params: ProjectIdParamsSchema,
        response: {
          200: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = request.params;

      const project = await projectService.getById(params.id);

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
    "/api/projects/:id",
    {
      schema: {
        params: ProjectIdParamsSchema,
        body: UpdateProjectRequestSchema,
        response: {
          200: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      const params = request.params;
      const body = request.body;

      if (Object.keys(body).length === 0) {
        throw new NotFoundError("At least one field must be provided for update");
      }

      const project = await projectService.update(params.id, {
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
    "/api/projects/:id",
    {
      schema: {
        params: ProjectIdParamsSchema,
        body: UpdateProjectRequestSchema,
        response: {
          200: ApiResponseSchema(ProjectSchema),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      const params = request.params;
      const body = request.body;

      if (Object.keys(body).length === 0) {
        throw new NotFoundError("At least one field must be provided for update");
      }

      const project = await projectService.update(params.id, {
        ...body,
        metadata: { ...(body.metadata ?? {}), updatedBy: userId },
      });

      return reply.status(200).send({ data: ProjectSchema.parse(project) });
    }
  );

  /**
   * DELETE /api/projects/:id
   * Deletes a project
   */
  server.delete(
    "/api/projects/:id",
    {
      schema: {
        params: ProjectIdParamsSchema,
        response: {
          204: {
            type: "null",
            description: "No content - project deleted successfully",
          },
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      const params = request.params;

      await projectService.delete(params.id);

      return reply.status(204).send();
    }
  );
}
