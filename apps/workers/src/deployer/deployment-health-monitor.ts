import { getDatabaseClient } from "@forge/database";
import type { HealthStatus, LogLevel, PrismaClient } from "@forge/database";
import type { ContainerStatus } from "@forge/database";
import { LoggerService } from "@forge/logger";
import { DockerRuntime } from "@forge/docker";
import type { ContainerInfo } from "@forge/docker";
import type { MetricsCollector } from "@forge/observability";
import { collectDockerStats } from "@forge/observability";
import type { QueueService } from "@forge/queue";
import type { NotificationRateLimiter } from "../notifier/rate-limiter.js";
import { createAlertAndDispatch } from "../notifier/dispatch-alert.js";

const POLL_STATUSES: ContainerStatus[] = ["RUNNING", "HEALTHY", "UNHEALTHY", "STARTING"];

const MAX_DOCKER_FAILURES = 3;

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "INFO",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "deployment-health-monitor",
});

interface DeploymentHealthMonitorOptions {
  pollIntervalMs?: number;
  metricsCollector: MetricsCollector;
  queueService?: QueueService;
  rateLimiter?: NotificationRateLimiter;
}

export class DeploymentHealthMonitor {
  private db: PrismaClient;
  private runtime: DockerRuntime;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly pollIntervalMs: number;
  private readonly metricsCollector: MetricsCollector;
  private dockerAvailable = true;
  private consecutiveDockerFailures = 0;
  private readonly queueService?: QueueService;
  private readonly rateLimiter?: NotificationRateLimiter;

  constructor(options: DeploymentHealthMonitorOptions) {
    this.db = getDatabaseClient();
    this.runtime = new DockerRuntime();
    this.pollIntervalMs = options.pollIntervalMs ?? 15_000;
    this.metricsCollector = options.metricsCollector;
    this.queueService = options.queueService;
    this.rateLimiter = options.rateLimiter;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    logger.info("Deployment health monitor starting", {
      pollIntervalMs: this.pollIntervalMs,
    });

    this.metricsCollector.start();
    await this.checkDockerAvailability();
    await this.pollAllContainers();

    this.timer = setInterval(() => {
      this.pollAllContainers().catch((err) => {
        logger.error("Deployment health poll cycle failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.pollIntervalMs);

    logger.info("Deployment health monitor started");
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.metricsCollector.stop();
    logger.info("Deployment health monitor stopped");
  }

  // ─── Polling ─────────────────────────────────────────────────────

  private async pollAllContainers(): Promise<void> {
    if (!this.dockerAvailable) {
      await this.checkDockerRecovery();
      return;
    }

    const containers = await this.db.container.findMany({
      where: {
        status: { in: POLL_STATUSES },
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
        await this.pollContainer(container);
      } catch (err) {
        logger.error("Failed to poll deployment container", {
          containerId: container.id,
          deploymentId: container.deploymentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async pollContainer(container: {
    id: string;
    containerId: string;
    deploymentId: string;
    projectId: string;
    name: string | null;
    status: ContainerStatus;
    healthStatus: HealthStatus | null;
  }): Promise<void> {
    if (container.status === "CREATING" || container.status === "STARTING") {
      return;
    }

    let containerInfo: ContainerInfo;
    try {
      containerInfo = await this.runtime.inspect(container.containerId);
    } catch (err) {
      if (this.isDockerConnectionError(err)) {
        this.handleDockerConnectionError();
        return;
      }

      // Container no longer exists in Docker
      if (container.status !== "ERROR") {
        logger.warn("Deployment container not found in Docker", {
          containerId: container.id,
          deploymentId: container.deploymentId,
        });

        this.metricsCollector.record({
          sourceType: "CONTAINER",
          sourceId: container.id,
          sourceName: container.name ?? container.containerId.substring(0, 12),
          metric: "health_status",
          value: 0,
          projectId: container.projectId,
        });

        await this.checkAndFireAlert(
          container.id,
          container.deploymentId,
          container.projectId,
          container.name ?? container.containerId.substring(0, 12),
          container.status,
          "ERROR"
        );
      }
      return;
    }

    // Map Docker state to ContainerStatus
    const newStatus = mapDockerStateToStatus(containerInfo);
    const newHealthStatus = mapDockerHealthToHealthStatus(containerInfo);

    // Record health metric
    const isHealthy = newHealthStatus === "HEALTHY";
    this.metricsCollector.record({
      sourceType: "CONTAINER",
      sourceId: container.id,
      sourceName: container.name ?? container.containerId.substring(0, 12),
      metric: "health_status",
      value: isHealthy ? 1 : 0,
      projectId: container.projectId,
    });

    // Fire alert on healthy → unhealthy/error transitions
    if (newStatus !== container.status || newHealthStatus !== container.healthStatus) {
      await this.checkAndFireAlert(
        container.id,
        container.deploymentId,
        container.projectId,
        container.name ?? container.containerId.substring(0, 12),
        container.status,
        newStatus
      );
    }

    // Collect resource stats for running containers
    if (containerInfo.state.running) {
      try {
        const stats = await this.runtime.stats(container.containerId);

        const records = collectDockerStats({
          containerId: container.containerId,
          serviceId: container.id,
          serviceName: container.name ?? container.containerId.substring(0, 12),
          projectId: container.projectId,
          stats,
          sourceType: "CONTAINER",
        });

        this.metricsCollector.recordMany(records);
      } catch (err) {
        if (this.isDockerConnectionError(err)) {
          this.handleDockerConnectionError();
          return;
        }

        logger.error("Failed to collect stats for deployment container", {
          containerId: container.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ─── Alerts ──────────────────────────────────────────────────────

  private async checkAndFireAlert(
    containerId: string,
    deploymentId: string,
    projectId: string,
    containerName: string,
    previousStatus: ContainerStatus,
    newStatus: ContainerStatus
  ): Promise<void> {
    // Only fire alerts on transitions from healthy to unhealthy/error
    if (previousStatus !== "HEALTHY" && previousStatus !== "RUNNING") return;
    if (newStatus !== "UNHEALTHY" && newStatus !== "ERROR") return;

    const rules = await this.db.alertRule.findMany({
      where: {
        projectId,
        enabled: true,
        sourceType: "CONTAINER",
      },
      include: { alerts: { where: { status: "FIRING" } } },
    });

    for (const rule of rules) {
      if (rule.alerts.length > 0) continue;

      await createAlertAndDispatch(this.db, this.queueService ?? null, this.rateLimiter ?? null, {
        ruleId: rule.id,
        status: "FIRING",
        severity: rule.severity,
        value: 0,
        message: `Deployment container "${containerName}" (deployment: ${deploymentId}) is ${newStatus}`,
      });

      logger.info("Alert fired for unhealthy deployment container", {
        containerId,
        ruleId: rule.id,
        severity: rule.severity,
      });
    }
  }

  // ─── Docker Availability ─────────────────────────────────────────

  private async checkDockerAvailability(): Promise<void> {
    try {
      await this.runtime.list();
      this.dockerAvailable = true;
      this.consecutiveDockerFailures = 0;
    } catch (err) {
      this.dockerAvailable = false;
      logger.warn("Docker is not available at startup", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private isDockerConnectionError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return (
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("socket") ||
      msg.includes("connect") ||
      msg.includes("docker daemon")
    );
  }

  private handleDockerConnectionError(): void {
    this.consecutiveDockerFailures++;

    if (this.consecutiveDockerFailures >= MAX_DOCKER_FAILURES && this.dockerAvailable) {
      this.dockerAvailable = false;
      logger.warn("Docker appears unavailable — pausing deployment health checks", {
        consecutiveFailures: this.consecutiveDockerFailures,
      });
    }
  }

  private async checkDockerRecovery(): Promise<void> {
    try {
      await this.runtime.list();
      this.consecutiveDockerFailures = 0;
      this.dockerAvailable = true;
      logger.info("Docker back online — resuming deployment health checks");
    } catch {
      this.consecutiveDockerFailures++;
      logger.warn("Docker still unavailable", {
        consecutiveFailures: this.consecutiveDockerFailures,
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
