import type { ILogger } from "@forge/core";
import type { PrismaClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";

const RECONCILE_INTERVAL_MS = Number.parseInt(
  process.env.DEPLOY_RECONCILE_INTERVAL_MS ?? "60000",
  10
);
const STUCK_THRESHOLD_MS = Number.parseInt(process.env.DEPLOY_STUCK_THRESHOLD_MS ?? "600000", 10);
const ORPHAN_GRACE_PERIOD_MS = Number.parseInt(
  process.env.DEPLOY_ORPHAN_GRACE_PERIOD_MS ?? "300000",
  10
);

const TERMINAL_DEPLOYMENT_STATUSES = ["FAILED", "SUCCEEDED", "CANCELLED", "TIMED_OUT"] as const;

const ACTIVE_CONTAINER_STATUSES = [
  "CREATING",
  "STARTING",
  "RUNNING",
  "HEALTHY",
  "UNHEALTHY",
  "ERROR",
] as const;

export class DeploymentReconciler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly runtime: DockerRuntime,
    private readonly logger: ILogger,
    private readonly intervalMs = RECONCILE_INTERVAL_MS
  ) {}

  start(): void {
    if (this.timer) {
      this.logger.warn("Deployment reconciler already running");
      return;
    }

    this.logger.info("Starting deployment reconciler", {
      intervalMs: this.intervalMs,
      stuckThresholdMs: STUCK_THRESHOLD_MS,
      orphanGracePeriodMs: ORPHAN_GRACE_PERIOD_MS,
    });

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
    } catch (error) {
      this.logger.error("Reconciler cycle failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }

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

  private async reconcilePhantomDbContainers(): Promise<void> {
    const phantomContainers = await this.db.container.findMany({
      where: {
        status: { in: [...ACTIVE_CONTAINER_STATUSES] },
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
}
