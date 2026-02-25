import type { PrismaClient } from "@forge/database";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  type IDeploymentService,
} from "@forge/core";
import { QueueService } from "@forge/queue";
import {
  Deployment,
  DeploymentStatusSchema,
  type DeploymentStatus,
  type BuildJobData,
  BuildSourceType,
} from "@forge/types";

/**
 * Active deployment statuses that block new deployments
 */
const ACTIVE_DEPLOYMENT_STATUSES: DeploymentStatus[] = [
  "PENDING",
  "QUEUED",
  "BUILDING",
  "DEPLOYING",
];
const CANCELLABLE_DEPLOYMENT_STATUSES: DeploymentStatus[] = ["PENDING", "QUEUED", "BUILDING"];

/**
 * Derive the lock key as a BigInt from the first 16 hex chars of the project UUID
 * This provides a 64-bit integer key for PostgreSQL advisory locks
 */
function uuidToLockKey(uuid: string): bigint {
  const hex = uuid.replace(/-/g, "");
  return BigInt("0x" + hex.substring(0, 16));
}

/**
 * Checks if Prisma error is a unique constraint violation on version field
 * @param err - Error to check
 * @returns true if P2002 error on (projectId, version) constraint
 */
function isUniqueVersionViolation(err: unknown): err is { meta: { target: string[] } } {
  return (
    err instanceof Error &&
    "code" in err &&
    err.code === "P2002" &&
    "meta" in err &&
    typeof err.meta === "object" &&
    err.meta !== null &&
    "target" in err.meta &&
    Array.isArray(err.meta.target) &&
    (err.meta.target.includes("version") ||
      (err.meta.target.includes("projectId") && err.meta.target.includes("version")))
  );
}

/**
 * DeploymentService manages deployment operations
 *
 * Thread-safety notes:
 * - Concurrent deployment prevention uses PostgreSQL advisory locks
 * - Version uniqueness is enforced via database unique constraint (no TOCTOU race)
 * - Prisma P2002 errors are caught and converted to ConflictError
 * - Build job enqueue happens AFTER transaction commits to avoid race condition
 *
 * @remarks
 * The deploy() method uses a PostgreSQL advisory lock to prevent concurrent
 * deployments for the same project. The lock is acquired inside a transaction
 * using pg_try_advisory_xact_lock(), which automatically releases when the
 * transaction ends.
 *
 * If the lock cannot be acquired, it means another deployment is already
 * in progress for this project, and we return a ConflictError.
 *
 * The build job is enqueued AFTER the transaction commits. This ensures
 * the deployment record exists before the queue worker attempts to process it.
 * If the enqueue fails, we best-effort update the deployment to FAILED status.
 */
export class DeploymentService implements IDeploymentService {
  constructor(
    private readonly db: PrismaClient,
    private readonly queueService: QueueService
  ) {}

  /**
   * Lists deployments with optional filtering and pagination
   */
  async list(filters?: {
    projectId?: string;
    status?: DeploymentStatus;
    page?: number;
    limit?: number;
  }): Promise<{ deployments: Deployment[]; total: number }> {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: {
      projectId?: string;
      status?: DeploymentStatus;
    } = {};

    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters?.status) {
      const result = DeploymentStatusSchema.safeParse(filters.status);
      if (result.success) {
        where.status = result.data;
      } else {
        throw new BadRequestError(`Invalid deployment status: ${filters.status}`);
      }
    }

    const [deployments, total] = await Promise.all([
      this.db.deployment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db.deployment.count({ where }),
    ]);

    return {
      deployments,
      total,
    };
  }

  /**
   * Gets a deployment by ID
   * @returns Deployment or null if not found
   */
  async getById(id: string): Promise<Deployment | null> {
    return this.db.deployment.findUnique({
      where: { id },
    });
  }

  /**
   * Gets all deployments for a project
   * @deprecated Use list() with projectId filter instead
   */
  async getByProject(projectId: string): Promise<Deployment[]> {
    return this.db.deployment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Creates a new deployment with a specific version
   * @throws ConflictError if version already exists for this project
   */
  async create(projectId: string, version: string): Promise<Deployment> {
    try {
      return await this.db.deployment.create({
        data: {
          projectId,
          version: parseInt(version, 10),
          status: "PENDING",
        },
      });
    } catch (err) {
      // Convert P2002 unique constraint violation to ConflictError
      if (isUniqueVersionViolation(err)) {
        throw new ConflictError(`Deployment version ${version} already exists for this project`);
      }
      throw err;
    }
  }

  /**
   * Deploys a project (creates a new deployment with auto-incremented version)
   *
   * This method handles the complete deployment orchestration:
   * 1. Acquires PostgreSQL advisory lock to prevent concurrent deployments
   * 2. Checks for existing active deployments
   * 3. Determines next version number
   * 4. Creates deployment record in transaction
   * 5. Updates project status to DEPLOYING
   * 6. Enqueues build job (outside transaction)
   *
   * @throws NotFoundError if project doesn't exist
   * @throws ConflictError if project has an active deployment or lock can't be acquired
   * @throws ConflictError if version number is exhausted
   */
  async deploy(projectId: string, version?: string): Promise<Deployment> {
    const lockKey = uuidToLockKey(projectId);

    const result = await this.db.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundError("Project");
      }

      // Acquire advisory lock and check for active deployments
      const lockResult = await tx.$queryRaw<Array<{ acquired: boolean; has_active: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${lockKey}::bigint) AS acquired,
               EXISTS(
                 SELECT 1 FROM deployments
                 WHERE project_id = ${projectId}
                 AND status = ANY(${ACTIVE_DEPLOYMENT_STATUSES})
               ) AS has_active
      `;

      const lockState = lockResult[0];
      if (!lockState?.acquired) {
        throw new ConflictError("Deployment already in progress");
      }

      if (lockState?.has_active) {
        throw new ConflictError("Project has an active deployment");
      }

      // Get the next version number (max existing version + 1, or 1 if none exist)
      const maxVersionResult = await tx.$queryRaw<Array<{ max_version: number | null }>>`
        SELECT COALESCE(MAX(version), 0) AS max_version
        FROM deployments
        WHERE project_id = ${projectId}
      `;

      const maxVersion = maxVersionResult[0]?.max_version ?? 0;
      const nextVersion = version ? parseInt(version, 10) : maxVersion + 1;

      if (nextVersion > Number.MAX_SAFE_INTEGER) {
        throw new ConflictError("Version number exhausted for this project");
      }

      let deployment: Deployment;
      try {
        deployment = await tx.deployment.create({
          data: {
            projectId,
            version: nextVersion,
            status: "PENDING",
            strategy: "ROLLING",
          },
        });
      } catch (err) {
        if (isUniqueVersionViolation(err)) {
          throw new ConflictError(
            `Deployment version ${nextVersion} already exists for this project`
          );
        }
        throw err;
      }

      await tx.project.update({
        where: { id: projectId },
        data: { status: "INACTIVE" }, // Using INACTIVE to indicate deployment in progress
      });

      return deployment;
    });

    try {
      const project = await this.db.project.findUnique({
        where: { id: projectId },
        select: { sourceType: true, sourceUrl: true },
      });

      const sourceType = (project?.sourceType as BuildSourceType) || BuildSourceType.GIT;

      const jobData: BuildJobData = {
        deploymentId: result.id,
        projectId,
        version: result.version.toString(),
        sourceType,
      };

      if (sourceType === BuildSourceType.GIT) {
        const gitIntegration = await this.db.gitIntegration.findUnique({
          where: { projectId },
        });
        jobData.gitUrl = project?.sourceUrl ?? gitIntegration?.repository;
        jobData.branch = gitIntegration?.branch ?? "main";
      } else if (sourceType === BuildSourceType.LOCAL) {
        jobData.localPath = project?.sourceUrl ?? "";
      } else if (sourceType === BuildSourceType.IMAGE) {
        jobData.imageUrl = project?.sourceUrl ?? "";
      }

      await this.queueService.addJob("build", "build-deployment", jobData);
    } catch {
      // Best-effort: update deployment to FAILED if enqueue fails
      // We don't want the deployment to be stuck in PENDING forever
      try {
        await this.db.deployment.update({
          where: { id: result.id },
          data: {
            status: "FAILED",
            error: "Failed to enqueue build job",
          },
        });
      } catch {
        // If this fails too, we'll rely on a recovery mechanism
      }
      throw new ConflictError("Failed to enqueue build job");
    }

    return result;
  }

  /**
   * Updates the status of a deployment
   * @throws NotFoundError if deployment doesn't exist
   */
  async updateStatus(id: string, status: DeploymentStatus, error?: string): Promise<Deployment> {
    return this.db.deployment.update({
      where: { id },
      data: {
        status,
        ...(error && { error }),
        ...(status === "BUILDING" && { buildStartedAt: new Date() }),
        ...(status === "DEPLOYING" && { deployStartedAt: new Date() }),
        ...(status === "SUCCEEDED" && {
          buildCompletedAt: new Date(),
          deployCompletedAt: new Date(),
        }),
        ...(status === "FAILED" && { buildCompletedAt: new Date() }),
      },
    });
  }

  /**
   * Cancels a deployment
   *
   * Only deployments in PENDING, QUEUED, or BUILDING status can be cancelled.
   * Deployments in DEPLOYING or later stages cannot be cancelled.
   *
   * @throws NotFoundError if deployment doesn't exist
   * @throws BadRequestError if deployment is in a non-cancellable state
   */
  async cancel(id: string): Promise<void> {
    const deployment = await this.db.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      throw new NotFoundError("Deployment");
    }

    if (!CANCELLABLE_DEPLOYMENT_STATUSES.includes(deployment.status)) {
      throw new BadRequestError(
        `Cannot cancel deployment with status ${deployment.status}. ` +
          `Only ${CANCELLABLE_DEPLOYMENT_STATUSES.join(", ")} deployments can be cancelled.`
      );
    }

    await this.db.deployment.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });
  }

  /**
   * Gets deployment logs
   *
   * Currently a stub that returns a placeholder message.
   * In Sprint 4, this will be replaced with real streaming logs.
   */
  async getLogs(id: string): Promise<string> {
    const deployment = await this.db.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      throw new NotFoundError("Deployment");
    }

    // Stub for now - Sprint 4 will implement real log streaming
    return `Deployment ${id} logs will be available in Sprint 4.`;
  }
}
