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
  type DeploymentStatus,
  type DeploymentStrategy,
  type BuildJobData,
  ProjectSourceType,
  ProjectConfigSchema,
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
  const unsigned = BigInt("0x" + hex.substring(0, 16));

  const MAX_INT64 = BigInt("0x7FFFFFFFFFFFFFFF");
  const UINT64_MOD = BigInt("0x10000000000000000"); // 2^64

  return unsigned > MAX_INT64 ? unsigned - UINT64_MOD : unsigned;
}

export class DeploymentService implements IDeploymentService {
  constructor(
    private readonly db: PrismaClient,
    private readonly queueService: QueueService
  ) {}

  // TODO: Search implementation needs to be added properly
  async list(filters?: {
    projectId?: string;
    status?: DeploymentStatus | DeploymentStatus[];
    strategy?: DeploymentStrategy | DeploymentStrategy[];
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ deployments: Deployment[]; total: number }> {
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: {
      projectId?: string;
      status?: { in: DeploymentStatus[] };
      strategy?: { in: DeploymentStrategy[] };
      id?: {
        in: [string];
      };
    } = {};

    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters?.status !== undefined) {
      const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (statusArray.length > 0) {
        where.status = { in: statusArray };
      }
    }

    if (filters?.strategy !== undefined) {
      const strategyArray = Array.isArray(filters.strategy) ? filters.strategy : [filters.strategy];
      if (strategyArray.length > 0) {
        where.strategy = { in: strategyArray };
      }
    }

    if (filters?.search !== undefined) {
      // where.id = {
      //   in: [filters.search],
      // };
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
      include: { urls: true },
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

  async create(projectId: string): Promise<Deployment> {
    return await this.db.deployment.create({
      data: {
        projectId,
        status: "PENDING",
      },
    });
  }

  /**
   * Deploys a project (creates a new deployment)
   *
   * This method handles the complete deployment orchestration:
   * 1. Acquires PostgreSQL advisory lock to prevent concurrent deployments
   * 2. Checks for existing active deployments
   * 3. Creates deployment record in transaction
   * 4. Updates project status to DEPLOYING
   * 5. Enqueues build job (outside transaction)
   *
   * @param projectId - ID of the project to deploy
   * @param options - Optional deployment configuration (git branch, commit, build args)
   * @throws NotFoundError if project doesn't exist
   * @throws ConflictError if project has an active deployment or lock can't be acquired
   */
  async deploy(
    projectId: string,
    options?: {
      gitBranch?: string;
      gitCommit?: string;
      buildArgs?: Record<string, string>;
      strategy?: DeploymentStrategy;
    }
  ): Promise<Deployment> {
    const lockKey = uuidToLockKey(projectId);

    const result = await this.db.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundError("Project");
      }

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

      // Resolve strategy: request option → project config default → ROLLING
      const projectConfig = ProjectConfigSchema.safeParse(project.config);
      const projectDefaultStrategy = projectConfig.success
        ? projectConfig.data.deploy?.strategy
        : undefined;
      const resolvedStrategy = options?.strategy ?? projectDefaultStrategy ?? "ROLLING";

      const deployment = await tx.deployment.create({
        data: {
          projectId,
          status: "PENDING",
          strategy: resolvedStrategy,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: "INACTIVE" }, // Using INACTIVE to indicate deployment in progress
      });

      return deployment;
    });

    try {
      const project = await this.db.project.findUnique({
        where: { id: projectId },
        select: { sourceType: true, sourceUrl: true, config: true },
      });

      const sourceType = (project?.sourceType as ProjectSourceType) || ProjectSourceType.GIT;

      const jobData: BuildJobData = {
        deploymentId: result.id,
        projectId,
        sourceType,
        buildArgs: options?.buildArgs,
      };

      const projectConfig = ProjectConfigSchema.safeParse(project?.config);
      let branch = undefined;

      if (projectConfig.success) {
        branch = projectConfig.data.build?.branch ?? undefined;
      }

      if (sourceType === ProjectSourceType.GIT) {
        const gitIntegration = await this.db.gitIntegration.findUnique({
          where: { projectId },
        });
        jobData.gitUrl = project?.sourceUrl ?? gitIntegration?.repository;
        jobData.branch = options?.gitBranch ?? branch ?? gitIntegration?.branch ?? "main";
        jobData.gitCommit = options?.gitCommit;
      } else if (sourceType === ProjectSourceType.LOCAL) {
        jobData.localPath = project?.sourceUrl ?? "";
      } else if (sourceType === ProjectSourceType.IMAGE) {
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
