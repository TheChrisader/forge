import type { ILogger } from "@forge/core";
import type { PrismaClient } from "@forge/database";
import type { ContainerStatus, HealthStatus } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { ContainerInfo } from "@forge/docker";

const RECONCILE_INTERVAL_MS = Number.parseInt(
  process.env.DEPLOY_RECONCILE_INTERVAL_MS ?? "60000",
  10
);
const STUCK_THRESHOLD_MS = Number.parseInt(process.env.DEPLOY_STUCK_THRESHOLD_MS ?? "600000", 10);
const ORPHAN_GRACE_PERIOD_MS = Number.parseInt(
  process.env.DEPLOY_ORPHAN_GRACE_PERIOD_MS ?? "300000",
  10
);

const TERMINAL_DEPLOYMENT_STATUSES = ["FAILED", "CANCELLED", "TIMED_OUT", "STOPPED"] as const;

const ACTIVE_CONTAINER_STATUSES: ContainerStatus[] = [
  "CREATING",
  "STARTING",
  "RUNNING",
  "HEALTHY",
  "UNHEALTHY",
  "ERROR",
];

const RECONCILE_CONTAINER_STATUSES: ContainerStatus[] = [
  "CREATING",
  "STARTING",
  "RUNNING",
  "HEALTHY",
  "UNHEALTHY",
];

export class DeploymentReconciler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly runtime: DockerRuntime,
    private readonly logger: ILogger,
    private readonly intervalMs = RECONCILE_INTERVAL_MS
  ) {}

  async start(): Promise<void> {
    if (this.timer) {
      this.logger.warn("Deployment reconciler already running");
      return;
    }

    this.logger.info("Starting deployment reconciler", {
      intervalMs: this.intervalMs,
      stuckThresholdMs: STUCK_THRESHOLD_MS,
      orphanGracePeriodMs: ORPHAN_GRACE_PERIOD_MS,
    });

    await this.runStartupReconciliation();
    void this.reconcile();

    this.timer = setInterval(() => {
      void this.reconcile();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.logger.info("Deployment reconciler stopped");
  }

  // ─── Startup Reconciliation ──────────────────────────────────────

  private async runStartupReconciliation(): Promise<void> {
    this.logger.info("Running startup reconciliation...");

    try {
      await this.runtime.list();
    } catch (err) {
      this.logger.warn("Docker is not available during startup reconciliation", {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    await this.reconcileContainerHealth();
    this.logger.info("Startup reconciliation complete");
  }

  // ─── Reconciliation Cycle ────────────────────────────────────────

  private async reconcile(): Promise<void> {
    if (this.running) {
      this.logger.debug("Reconciler cycle skipped — previous cycle still running");
      return;
    }

    this.running = true;

    try {
      await this.reconcileStuckDeployments();
      await this.reconcileOrphanedContainers();
      await this.reconcilePhantomDbContainers();
      await this.reconcileContainerHealth();
    } catch (error) {
      this.logger.error("Reconciler cycle failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }

  // ─── Stuck Deployments ───────────────────────────────────────────

  private async reconcileStuckDeployments(): Promise<void> {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

    const stuckDeployments = await this.db.deployment.findMany({
      where: {
        status: { in: ["DEPLOYING", "BUILDING", "QUEUED"] },
        createdAt: { lt: threshold },
      },
      select: { id: true, status: true, projectId: true, createdAt: true },
    });

    if (stuckDeployments.length === 0) return;

    this.logger.warn("Found stuck deployments", { count: stuckDeployments.length });

    for (const deployment of stuckDeployments) {
      const stuckDuration = Date.now() - deployment.createdAt.getTime();

      this.logger.warn("Reconciling stuck deployment", {
        deploymentId: deployment.id,
        status: deployment.status,
        stuckDurationMs: stuckDuration,
      });

      try {
        const containers = await this.runtime.list({
          label: {
            "forge.deploymentId": deployment.id,
          },
        });

        for (const container of containers) {
          try {
            await this.runtime.stop(container.id, { timeout: 10_000 });
          } catch {
            // Container may already be stopped
          }
          try {
            await this.runtime.remove(container.id, { force: true });
          } catch {
            // Container may already be removed
          }
        }
      } catch (dockerError) {
        this.logger.error("Failed to clean up Docker containers for stuck deployment", {
          deploymentId: deployment.id,
          error: dockerError instanceof Error ? dockerError.message : String(dockerError),
        });
      }

      await this.db.container.updateMany({
        where: {
          deploymentId: deployment.id,
          status: { notIn: ["TERMINATED", "STOPPED"] },
        },
        data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
      });

      await this.db.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "FAILED",
          error: `Deployment stuck in ${deployment.status} state for ${Math.round(stuckDuration / 1000)}s — reconciled automatically`,
        },
      });

      this.logger.warn("deployment.reconciled", {
        deploymentId: deployment.id,
        previousStatus: deployment.status,
        stuckDurationMs: stuckDuration,
      });
    }
  }

  // ─── Orphaned Containers ─────────────────────────────────────────

  private async reconcileOrphanedContainers(): Promise<void> {
    const graceCutoff = new Date(Date.now() - ORPHAN_GRACE_PERIOD_MS);

    const dockerContainers = await this.runtime.list({
      label: {
        "forge.type": "deployment-container",
        "forge.managed": "true",
      },
    });

    if (dockerContainers.length === 0) return;

    let orphanedCount = 0;

    for (const container of dockerContainers) {
      const deploymentId = container.labels?.["forge.deploymentId"];
      if (!deploymentId) continue;

      if (container.created > graceCutoff) continue;

      const deployment = await this.db.deployment.findUnique({
        where: { id: deploymentId },
        select: { id: true, status: true, projectId: true },
      });

      const isDeploymentTerminal =
        deployment?.status &&
        TERMINAL_DEPLOYMENT_STATUSES.includes(
          deployment.status as (typeof TERMINAL_DEPLOYMENT_STATUSES)[number]
        );
      const isMissing = !deployment;

      if (!isDeploymentTerminal && !isMissing) continue;

      this.logger.warn("container.orphaned", {
        containerId: container.id,
        deploymentId,
        reason: isMissing ? "deployment_not_found" : `deployment_${deployment!.status}`,
      });

      try {
        await this.runtime.stop(container.id, { timeout: 10_000 });
        await this.runtime.remove(container.id, { force: true });
      } catch (err) {
        this.logger.error("Failed to remove orphaned container", {
          containerId: container.id,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      await this.db.container.updateMany({
        where: { containerId: container.id },
        data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
      });

      this.logger.warn("container.reconciled", {
        containerId: container.id,
        deploymentId,
      });

      orphanedCount++;
    }

    if (orphanedCount > 0) {
      this.logger.info("Orphaned container reconciliation complete", { count: orphanedCount });
    }
  }

  // ─── Phantom DB Containers ───────────────────────────────────────

  private async reconcilePhantomDbContainers(): Promise<void> {
    const phantomContainers = await this.db.container.findMany({
      where: {
        status: { in: ACTIVE_CONTAINER_STATUSES },
        deployment: {
          status: { in: [...TERMINAL_DEPLOYMENT_STATUSES] },
        },
      },
      select: {
        id: true,
        containerId: true,
        deploymentId: true,
        deployment: { select: { status: true } },
      },
    });

    if (phantomContainers.length === 0) return;

    this.logger.warn("Found phantom DB containers", { count: phantomContainers.length });

    for (const container of phantomContainers) {
      this.logger.warn("container.phantom", {
        containerId: container.containerId,
        dbId: container.id,
        deploymentId: container.deploymentId,
        deploymentStatus: container.deployment.status,
      });

      try {
        await this.runtime.stop(container.containerId, { timeout: 10_000 });
      } catch {
        // Container may not exist in Docker
      }
      try {
        await this.runtime.remove(container.containerId, { force: true });
      } catch {
        // Container may not exist in Docker
      }

      await this.db.container.update({
        where: { id: container.id },
        data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
      });
    }
  }

  // ─── Container Health Reconciliation ─────────────────────────────

  private async reconcileContainerHealth(): Promise<void> {
    const containers = await this.db.container.findMany({
      where: {
        status: { in: RECONCILE_CONTAINER_STATUSES },
        deletedAt: null,
      },
      select: {
        id: true,
        containerId: true,
        deploymentId: true,
        projectId: true,
        name: true,
        status: true,
        healthStatus: true,
      },
    });

    for (const container of containers) {
      try {
        await this.reconcileContainer(container);
      } catch (err) {
        this.logger.error("Container health reconciliation failed", {
          containerId: container.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async reconcileContainer(container: {
    id: string;
    containerId: string;
    deploymentId: string;
    projectId: string;
    name: string | null;
    status: ContainerStatus;
    healthStatus: HealthStatus | null;
  }): Promise<void> {
    let containerInfo: ContainerInfo | null = null;

    try {
      containerInfo = await this.runtime.inspect(container.containerId);
    } catch {
      // Container not found in Docker
    }

    if (containerInfo) {
      const newStatus = mapDockerStateToStatus(containerInfo);
      const newHealthStatus = mapDockerHealthToHealthStatus(containerInfo);

      if (containerInfo.state.running) {
        switch (container.status) {
          case "CREATING":
          case "STARTING": {
            this.logger.info("reconciliation: container in transient state but is running", {
              containerId: container.id,
              previousStatus: container.status,
              newStatus,
            });
            await this.db.container.update({
              where: { id: container.id },
              data: { status: newStatus, healthStatus: newHealthStatus },
            });
            break;
          }

          default: {
            if (newStatus !== container.status || newHealthStatus !== container.healthStatus) {
              this.logger.info("reconciliation: container status drift detected", {
                containerId: container.id,
                from: container.status,
                to: newStatus,
                healthFrom: container.healthStatus,
                healthTo: newHealthStatus,
              });
              await this.db.container.update({
                where: { id: container.id },
                data: { status: newStatus, healthStatus: newHealthStatus },
              });
            }
            break;
          }
        }
      } else {
        // Container exists but is stopped
        switch (container.status) {
          case "RUNNING":
          case "HEALTHY": {
            this.logger.info("reconciliation: running container is stopped, attempting restart", {
              containerId: container.id,
            });
            try {
              await this.runtime.start(containerInfo.id);
              await this.db.container.update({
                where: { id: container.id },
                data: { status: "STARTING", healthStatus: "STARTING" },
              });
            } catch (err) {
              this.logger.error("reconciliation: failed to restart container", {
                containerId: container.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            break;
          }

          case "CREATING":
          case "STARTING": {
            this.logger.info("reconciliation: container in transient state, trying to start", {
              containerId: container.id,
            });
            try {
              await this.runtime.start(containerInfo.id);
            } catch (err) {
              this.logger.error("reconciliation: failed to start container", {
                containerId: container.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            break;
          }

          default:
            break;
        }
      }
    } else {
      // Container does not exist in Docker
      switch (container.status) {
        case "CREATING":
        case "STARTING": {
          this.logger.debug(
            "reconciliation: container not yet created, provisioning may be in progress",
            {
              containerId: container.id,
              status: container.status,
            }
          );
          break;
        }

        case "RUNNING":
        case "HEALTHY":
        case "UNHEALTHY": {
          this.logger.info("reconciliation: container lost, marking as ERROR", {
            containerId: container.id,
            status: container.status,
          });
          await this.db.container.update({
            where: { id: container.id },
            data: { status: "ERROR", healthStatus: "UNHEALTHY", stoppedAt: new Date() },
          });
          await this.checkDeploymentHealth(container.deploymentId);
          break;
        }

        default:
          break;
      }
    }
  }

  // ─── Deployment Health Cascade ───────────────────────────────────

  private async checkDeploymentHealth(deploymentId: string): Promise<void> {
    const deployment = await this.db.deployment.findUnique({
      where: { id: deploymentId },
      select: { id: true, status: true },
    });

    if (!deployment || deployment.status !== "RUNNING") {
      return;
    }

    const activeContainers = await this.db.container.count({
      where: {
        deploymentId,
        status: { in: ["CREATING", "STARTING", "RUNNING", "HEALTHY"] },
        deletedAt: null,
      },
    });

    if (activeContainers === 0) {
      this.logger.info("reconciliation: deployment has no active containers, marking as FAILED", {
        deploymentId,
      });

      await this.db.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "FAILED",
          error: "All deployment containers failed or stopped",
        },
      });
    }
  }
}

// ─── Status Mappers ─────────────────────────────────────────────────

function mapDockerStateToStatus(containerInfo: ContainerInfo): ContainerStatus {
  if (!containerInfo.state.running) {
    return "STOPPED";
  }

  const healthStatus = containerInfo.health?.status;

  switch (healthStatus) {
    case "healthy":
      return "HEALTHY";
    case "unhealthy":
      return "UNHEALTHY";
    case "starting":
      return "STARTING";
    case "none":
    default:
      return "RUNNING";
  }
}

function mapDockerHealthToHealthStatus(containerInfo: ContainerInfo): HealthStatus {
  if (!containerInfo.state.running) {
    return "UNHEALTHY";
  }

  switch (containerInfo.health?.status) {
    case "healthy":
      return "HEALTHY";
    case "unhealthy":
      return "UNHEALTHY";
    case "starting":
      return "STARTING";
    case "none":
    default:
      return "HEALTHY";
  }
}
