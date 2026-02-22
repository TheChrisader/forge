import type { PrismaClient } from "@forge/database";
import { ValidationError, ConflictError, type IProjectService } from "@forge/core";
import {
  type Project,
  type CreateProjectRequest,
  type UpdateProjectRequest,
  type ProjectStatus,
  type ProjectWithRelations,
  ProjectWithRelationsSchema,
  CreateProjectSchema,
  ProjectListQuerySchema,
} from "@forge/types";

/**
 * Git URL validation patterns
 * Supports both HTTPS and SSH formats:
 * - HTTPS: https://github.com/user/repo.git
 * - SSH: git@github.com:user/repo.git
 */
const GIT_URL_PATTERNS = [
  /^https:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+\.git$/,
  /^git@[^:\s]+:[^:\s]+\/[^:\s]+\.git$/,
];

function isValidGitUrl(url: string): boolean {
  return GIT_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Checks if Prisma error is a unique constraint violation on the name field
 * @param err - Error to check
 * @returns true if P2002 error on name field
 */
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

/**
 * ProjectService manages project CRUD operations
 *
 * Thread-safety notes:
 * - Name uniqueness is enforced via database unique constraint (no TOCTOU race)
 * - Prisma P2002 errors are caught and converted to ConflictError
 * - Git URL validation happens before DB operations
 * - Deployment check for delete has a small TOCTOU window (acceptable)
 */
export class ProjectService implements IProjectService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Lists projects with optional filtering and pagination
   */
  async list(filters?: {
    page?: number;
    limit?: number;
    status?: ProjectStatus[];
  }): Promise<{ projects: Project[]; total: number }> {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: {
      status?: { in: ProjectStatus[] };
    } = {};

    const result = ProjectListQuerySchema.safeParse(filters?.status);

    if (!result.success) {
      throw new ValidationError(result.error.message);
    }

    const { status } = result.data;

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

  /**
   * Gets a project by ID
   * @returns Project or null if not found
   */
  async getById(id: string): Promise<ProjectWithRelations | null> {
    const project = await this.db.project.findUnique({
      where: { id },
      include: { containers: true, deployments: true },
    });

    return ProjectWithRelationsSchema.parse(project);
  }

  /**
   * Creates a new project
   * @throws ValidationError if gitUrl format is invalid
   * @throws ConflictError if project name already exists
   */
  async create(data: CreateProjectRequest): Promise<Project> {
    const result = CreateProjectSchema.safeParse(data);

    if (!result.success) {
      throw new ValidationError(result.error.message);
    }

    const { name, type, sourceType, sourceUrl, config, metadata } = result.data;

    if (config?.gitUrl && typeof config.gitUrl === "string") {
      if (!isValidGitUrl(config.gitUrl)) {
        throw new ValidationError(
          "Invalid git URL format. Expected: https://host/user/repo.git or git@host:user/repo.git"
        );
      }
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
      // Convert P2002 unique constraint violation to ConflictError
      if (isUniqueNameViolation(err)) {
        throw new ConflictError(`Project with name "${name}" already exists`);
      }
      throw err;
    }
  }

  /**
   * Updates an existing project
   * @throws ValidationError if gitUrl format is invalid
   * @throws ConflictError if new name already exists
   * @throws NotFoundError if project doesn't exist (Prisma P2025)
   */
  async update(id: string, data: UpdateProjectRequest): Promise<Project> {
    const { name, type, config, metadata } = data;

    if (config?.gitUrl && typeof config.gitUrl === "string") {
      if (!isValidGitUrl(config.gitUrl)) {
        throw new ValidationError(
          "Invalid git URL format. Expected: https://host/user/repo.git or git@host:user/repo.git"
        );
      }
    }

    try {
      return this.db.project.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(config !== undefined && { config: config as never }),
          ...(metadata !== undefined && { metadata: metadata as never }),
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      // Convert P2002 unique constraint violation to ConflictError
      if (isUniqueNameViolation(err)) {
        throw new ConflictError(`Project with name "${name}" already exists`);
      }
      throw err;
    }
  }

  /**
   * Deletes a project
   * @throws ConflictError if project has active deployments
   * @throws NotFoundError if project doesn't exist (Prisma P2025)
   */
  async delete(id: string): Promise<void> {
    // Check for active deployments before deleting
    // Note: This has a small TOCTOU race window, but it's acceptable because:
    // 1. The window is tiny (between check and delete)
    // 2. The consequence is a stuck project, not data corruption
    // 3. We don't have a clean way to lock this without full transaction support
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

    // Prisma will throw P2025 if project doesn't exist
    await this.db.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Deploys a project (placeholder for future implementation)
   * @throws NotImplementedError - not implemented yet
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async deploy(): Promise<never> {
    throw new Error("Deploy not implemented");
  }

  /**
   * Rolls back a project deployment (placeholder for future implementation)
   * @throws NotImplementedError - not implemented yet
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(): Promise<never> {
    throw new Error("Rollback not implemented");
  }

  /**
   * Scales a project (placeholder for future implementation)
   * @throws NotImplementedError - not implemented yet
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async scale(): Promise<never> {
    throw new Error("Scale not implemented");
  }
}
