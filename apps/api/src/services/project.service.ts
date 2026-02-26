import type { PrismaClient } from "@forge/database";
import {
  ValidationError,
  ConflictError,
  type IProjectService,
  isValidGitUrl,
  isValidImageUrl,
  isValidLocalPath,
} from "@forge/core";
import {
  type Project,
  type CreateProjectRequest,
  type UpdateProjectRequest,
  type ProjectStatus,
  type ProjectWithRelations,
  ProjectWithRelationsSchema,
  ProjectSourceType,
} from "@forge/types";

function isUniqueNameViolation(err: unknown): err is { meta: { target: string[] } } {
  return (
    err instanceof Error &&
    "code" in err &&
    err.code === "P2002" &&
    "meta" in err &&
    typeof err.meta === "object" &&
    err.meta !== null &&
    "target" in err.meta &&
    Array.isArray(err.meta.target) &&
    err.meta.target.includes("name")
  );
}

const ACTIVE_DEPLOYMENT_STATUSES = ["PENDING", "BUILDING", "DEPLOYING"] as const;

export class ProjectService implements IProjectService {
  constructor(private readonly db: PrismaClient) {}

  async list(filters?: {
    page?: number;
    limit?: number;
    status?: ProjectStatus[];
  }): Promise<{ projects: Project[]; total: number }> {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 10));
    const skip = (page - 1) * limit;

    const status = filters?.status;

    const where: {
      status?: { in: ProjectStatus[] };
    } = {};

    if (status && status.length > 0) {
      where.status = { in: status };
    }

    const [projects, total] = await Promise.all([
      this.db.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db.project.count({ where }),
    ]);

    return {
      projects,
      total,
    };
  }

  async getById(
    id: string,
    options?: { include?: string[] }
  ): Promise<ProjectWithRelations | null> {
    const include = options?.include ?? [];

    const project = await this.db.project.findUnique({
      where: { id },
      include: {
        gitIntegration: include.includes("gitIntegration"),
        containers: include.includes("containers")
          ? { take: 5, orderBy: { createdAt: "desc" } }
          : false,
        deployments: include.includes("deployments")
          ? { take: 5, orderBy: { createdAt: "desc" } }
          : false,
      },
    });

    if (!project) {
      return null;
    }

    return ProjectWithRelationsSchema.parse(project);
  }

  async create(data: CreateProjectRequest): Promise<Project> {
    const { name, type, sourceType, sourceUrl, config, metadata } = data;

    if (sourceType) {
      if (!sourceUrl || typeof sourceUrl !== "string") {
        throw new ValidationError(`Source URL is required when source type is "${sourceType}"`);
      }

      if (sourceType === ProjectSourceType.GIT && !isValidGitUrl(sourceUrl)) {
        throw new ValidationError(
          "Invalid git URL format. Expected: https://host/user/repo.git or git@host:user/repo.git"
        );
      }
      if (sourceType === ProjectSourceType.IMAGE && !isValidImageUrl(sourceUrl)) {
        throw new ValidationError("Invalid image format. Expected: registry/image:tag");
      }
      if (sourceType === ProjectSourceType.LOCAL && !isValidLocalPath(sourceUrl)) {
        throw new ValidationError(
          "Invalid local path format. Expected: /absolute/path or C:\\path"
        );
      }
      if (sourceType === ProjectSourceType.DOCKER_COMPOSE && !isValidLocalPath(sourceUrl)) {
        throw new ValidationError(
          "Invalid docker-compose path format. Expected: /absolute/path or C:\\path"
        );
      }
    } else if (sourceUrl && typeof sourceUrl === "string") {
      throw new ValidationError("Source type must be specified when providing a source URL");
    }

    try {
      return this.db.project.create({
        data: {
          name,
          type,
          sourceType,
          sourceUrl,
          config: config as never,
          metadata: (metadata ?? {}) as never,
        },
      });
    } catch (err) {
      if (isUniqueNameViolation(err)) {
        throw new ConflictError(`Project with name "${name}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, data: UpdateProjectRequest): Promise<Project> {
    const { name, type, sourceType, sourceUrl, config, metadata } = data;

    if (sourceType) {
      if (!sourceUrl || typeof sourceUrl !== "string") {
        throw new ValidationError(`Source URL is required when source type is "${sourceType}"`);
      }

      if (sourceType === ProjectSourceType.GIT && !isValidGitUrl(sourceUrl)) {
        throw new ValidationError(
          "Invalid git URL format. Expected: https://host/user/repo.git or git@host:user/repo.git"
        );
      }
      if (sourceType === ProjectSourceType.IMAGE && !isValidImageUrl(sourceUrl)) {
        throw new ValidationError("Invalid image format. Expected: registry/image:tag");
      }
      if (sourceType === ProjectSourceType.LOCAL && !isValidLocalPath(sourceUrl)) {
        throw new ValidationError(
          "Invalid local path format. Expected: /absolute/path or C:\\path"
        );
      }
      if (sourceType === ProjectSourceType.DOCKER_COMPOSE && !isValidLocalPath(sourceUrl)) {
        throw new ValidationError(
          "Invalid docker-compose path format. Expected: /absolute/path or C:\\path"
        );
      }
    } else if (sourceUrl && typeof sourceUrl === "string") {
      throw new ValidationError("Source type must be specified when providing a source URL");
    }

    try {
      return this.db.project.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(sourceType !== undefined && { sourceType }),
          ...(sourceUrl !== undefined && { sourceUrl }),
          ...(config !== undefined && { config: config as never }),
          ...(metadata !== undefined && { metadata: metadata as never }),
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      if (isUniqueNameViolation(err)) {
        throw new ConflictError(`Project with name "${name}" already exists`);
      }
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const activeDeployments = await this.db.deployment.count({
      where: {
        projectId: id,
        status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
      },
    });

    if (activeDeployments > 0) {
      throw new ConflictError(
        `Cannot delete project with ${activeDeployments} active deployment(s)`
      );
    }

    await this.db.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deploy(): Promise<never> {
    throw new Error("Deploy not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(): Promise<never> {
    throw new Error("Rollback not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async scale(): Promise<never> {
    throw new Error("Scale not implemented");
  }
}
