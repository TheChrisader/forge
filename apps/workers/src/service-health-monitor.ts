import { getDatabaseClient } from "@forge/database";
import type { PrismaClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import { NonNullFields, type LogLevel } from "@forge/types";
import { DockerRuntime } from "@forge/docker";
import type { ContainerInfo } from "@forge/docker";
import type { ServiceStatus } from "@forge/database";
import type { MetricsCollector } from "@forge/observability";
import { collectDockerStats } from "@forge/observability";
import { OrphanDetector } from "./service-provisioner/orphan-detector.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "service-health-monitor",
});

interface ServiceHealthMonitorOptions {
  pollIntervalMs?: number;
  metricsEnabled?: boolean;
  metricsCollector?: MetricsCollector;
}

export class ServiceHealthMonitor {
  private db: PrismaClient;
  private runtime: DockerRuntime;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly pollIntervalMs: number;
  private readonly metricsEnabled: boolean;
  private readonly metricsCollector?: MetricsCollector;
  private dockerAvailable = true;
  private consecutiveDockerFailures = 0;
  private readonly maxDockerFailuresBeforeUnavailable = 3;
  private healthCheckCycleCount = 0;
  private readonly reconciliationFrequency = 10; // every N cycles

  constructor(options?: ServiceHealthMonitorOptions) {
    this.db = getDatabaseClient();
    this.runtime = new DockerRuntime();
    this.pollIntervalMs = options?.pollIntervalMs ?? 15_000;
    this.metricsEnabled = options?.metricsEnabled ?? true;
    this.metricsCollector = options?.metricsCollector;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    logger.info("Service health monitor starting", {
      pollIntervalMs: this.pollIntervalMs,
      metricsEnabled: this.metricsEnabled,
    });

    if (this.metricsCollector) {
      this.metricsCollector.start();
    }

    // Run startup reconciliation before health checks
    await this.runStartupReconciliation();

    // Then run the first health check cycle
    await this.checkAllServices();

    this.timer = setInterval(() => {
      this.checkAllServices().catch((err) => {
        logger.error("Health check cycle failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.pollIntervalMs);

    logger.info("Service health monitor started");
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.metricsCollector) {
      await this.metricsCollector.stop();
    }

    logger.info("Service health monitor stopped");
  }

  private async runStartupReconciliation(): Promise<void> {
    logger.info("Running startup reconciliation...");

    // Test Docker connectivity first
    try {
      await this.runtime.list();
      this.dockerAvailable = true;
      this.consecutiveDockerFailures = 0;
    } catch (err) {
      logger.warn("Docker is not available during startup reconciliation", {
        error: err instanceof Error ? err.message : String(err),
      });
      this.dockerAvailable = false;
      return;
    }

    // Reconcile known services
    await this.reconcileServices();

    // Detect orphans
    try {
      const detector = new OrphanDetector(this.runtime, this.db);
      const orphans = await detector.findOrphanedResources();
      if (orphans.orphanedContainers.length > 0 || orphans.orphanedVolumes.length > 0) {
        logger.info("Orphaned resources detected during startup", {
          containers: orphans.orphanedContainers.length,
          volumes: orphans.orphanedVolumes.length,
        });
      }
    } catch (err) {
      logger.error("Orphan detection failed during startup", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    logger.info("Startup reconciliation complete");
  }

  private async reconcileServices(): Promise<void> {
    const activeStatuses: ServiceStatus[] = [
      "CREATING",
      "STARTING",
      "RUNNING",
      "HEALTHY",
      "UNHEALTHY",
      "UPGRADING",
      "BACKING_UP",
      "RESTORING",
    ];

    const services = await this.db.service.findMany({
      where: {
        status: { in: activeStatuses },
        deletedAt: null,
        engine: { not: null },
      },
      select: {
        id: true,
        name: true,
        engine: true,
        status: true,
        containerId: true,
        projectId: true,
        volumeName: true,
        version: true,
      },
    });

    for (const service of services) {
      try {
        await this.reconcileService(service);
      } catch (err) {
        logger.error("Reconciliation failed for service", {
          serviceId: service.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async reconcileService(service: {
    id: string;
    name: string;
    engine: string | null;
    status: ServiceStatus;
    containerId: string | null;
    projectId: string;
    volumeName: string | null;
    version: string | null;
  }): Promise<void> {
    const containerName = `forge-svc-${service.id.substring(0, 8)}`;
    let containerInfo: ContainerInfo | null = null;

    try {
      // Try by container ID first, then by name
      if (service.containerId) {
        try {
          containerInfo = await this.runtime.inspect(service.containerId);
        } catch {
          // Container ID lookup failed — try by name
        }
      }

      if (!containerInfo) {
        try {
          containerInfo = await this.runtime.inspect(containerName);
        } catch {
          // Container not found by name either
        }
      }
    } catch (err) {
      logger.error("Docker inspect failed during reconciliation", {
        serviceId: service.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (containerInfo) {
      // Container exists
      if (containerInfo.state.running) {
        // Container exists and is running
        const dockerHealth = mapDockerHealthToStatus(containerInfo);

        switch (service.status) {
          case "CREATING":
          case "STARTING":
            // Provisioning may have completed before crash — update to actual state
            logger.info("reconciliation: service in transient state but container is running", {
              serviceId: service.id,
              previousStatus: service.status,
              newStatus: dockerHealth,
            });
            await this.db.service.update({
              where: { id: service.id },
              data: { status: dockerHealth, containerId: containerInfo.id },
            });
            break;

          case "UPGRADING": {
            if (dockerHealth === "HEALTHY" || dockerHealth === "RUNNING") {
              logger.info("reconciliation: upgrade appears to have completed", {
                serviceId: service.id,
              });
              await this.db.service.update({
                where: { id: service.id },
                data: { status: dockerHealth, containerId: containerInfo.id },
              });
            } else {
              // Upgrade didn't finish properly — the old container is still running
              logger.info(
                "reconciliation: upgrade incomplete, container still running with old version",
                {
                  serviceId: service.id,
                }
              );
              await this.db.service.update({
                where: { id: service.id },
                data: { status: dockerHealth, containerId: containerInfo.id },
              });
            }
            break;
          }

          case "BACKING_UP":
          case "RESTORING":
            // Transient operations that likely completed
            logger.info("reconciliation: transient operation completed", {
              serviceId: service.id,
              previousStatus: service.status,
              newStatus: dockerHealth,
            });
            await this.db.service.update({
              where: { id: service.id },
              data: { status: dockerHealth },
            });
            break;

          default:
            // Refresh from Docker health status
            if (dockerHealth !== service.status) {
              logger.info("reconciliation: status drift detected", {
                serviceId: service.id,
                previousStatus: service.status,
                newStatus: dockerHealth,
              });
              await this.db.service.update({
                where: { id: service.id },
                data: { status: dockerHealth },
              });
            }
            break;
        }
      } else {
        // Container exists but is stopped
        switch (service.status) {
          case "RUNNING":
          case "HEALTHY":
            // Container crashed — attempt restart
            logger.info(
              "reconciliation: running service container is stopped, attempting restart",
              {
                serviceId: service.id,
              }
            );
            try {
              await this.runtime.start(containerInfo.id);
              await this.db.service.update({
                where: { id: service.id },
                data: { status: "STARTING", containerId: containerInfo.id },
              });
            } catch (err) {
              logger.error("reconciliation: failed to restart container", {
                serviceId: service.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            break;

          case "CREATING":
          case "STARTING":
            // Try to start the container
            logger.info("reconciliation: service in transient state, trying to start container", {
              serviceId: service.id,
            });
            try {
              await this.runtime.start(containerInfo.id);
            } catch (err) {
              logger.error("reconciliation: failed to start container", {
                serviceId: service.id,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            break;

          case "STOPPED":
            // Intentionally stopped — leave as-is
            break;

          default:
            break;
        }
      }
    } else {
      // Container does not exist
      switch (service.status) {
        case "CREATING":
        case "STARTING":
          // Provisioning may still be in progress — skip to avoid racing with the worker
          logger.debug(
            "reconciliation: container not yet created, provisioning may be in progress",
            {
              serviceId: service.id,
              status: service.status,
            }
          );
          break;

        case "RUNNING":
        case "HEALTHY":
        case "UNHEALTHY":
          // Container lost — re-provision
          logger.info("reconciliation: container lost, service needs re-provisioning", {
            serviceId: service.id,
            status: service.status,
          });
          await this.db.service.update({
            where: { id: service.id },
            data: { status: "ERROR", containerId: null },
          });
          break;

        case "UPGRADING":
          // Upgrade didn't complete — mark as error, upgrade handler will need to be re-run
          logger.info("reconciliation: upgrade in progress but container gone", {
            serviceId: service.id,
          });
          await this.db.service.update({
            where: { id: service.id },
            data: { status: "ERROR", containerId: null },
          });
          break;

        case "STOPPED":
          // Intentionally stopped — leave as-is
          break;

        default:
          break;
      }
    }
  }

  private async checkAllServices(): Promise<void> {
    // Check Docker availability
    if (!this.dockerAvailable) {
      await this.checkDockerRecovery();
      return;
    }

    this.healthCheckCycleCount++;

    const services = (await this.db.service.findMany({
      where: {
        status: {
          in: ["RUNNING", "HEALTHY", "UNHEALTHY", "STARTING"],
        },
        deletedAt: null,
        containerId: { not: null },
        engine: { not: null },
      },
      select: {
        id: true,
        name: true,
        engine: true,
        status: true,
        containerId: true,
        projectId: true,
      },
    })) as NonNullFields<
      {
        id: string;
        projectId: string;
        name: string;
        engine: string | null;
        status: ServiceStatus;
        containerId: string | null;
      },
      "containerId" | "engine"
    >[];

    for (const service of services) {
      try {
        await this.checkService(service);
      } catch (err) {
        logger.error("Failed to check service health", {
          serviceId: service.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Periodic lightweight reconciliation
    if (this.healthCheckCycleCount % this.reconciliationFrequency === 0) {
      try {
        await this.reconcileServices();
      } catch (err) {
        logger.error("Periodic reconciliation failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async checkDockerRecovery(): Promise<void> {
    try {
      await this.runtime.list();
      this.consecutiveDockerFailures = 0;
      this.dockerAvailable = true;

      logger.info("Docker is back online — running reconciliation to re-sync services");
      await this.reconcileServices();
    } catch {
      this.consecutiveDockerFailures++;
      logger.warn("Docker still unavailable", {
        consecutiveFailures: this.consecutiveDockerFailures,
      });
    }
  }

  private async checkService(service: {
    id: string;
    name: string;
    engine: string;
    status: ServiceStatus;
    containerId: string;
    projectId: string;
  }): Promise<void> {
    // Skip services being operated on by job handlers
    if (
      service.status === "CREATING" ||
      service.status === "STARTING" ||
      service.status === "BACKING_UP" ||
      service.status === "RESTORING" ||
      service.status === "UPGRADING"
    ) {
      return;
    }

    let containerInfo: ContainerInfo;
    try {
      containerInfo = await this.runtime.inspect(service.containerId);
    } catch (err) {
      const isConnectionError = this.isDockerConnectionError(err);

      if (isConnectionError) {
        await this.handleDockerConnectionError();
        return;
      }

      // Container not found in Docker — mark as ERROR
      if (service.status !== "ERROR") {
        logger.warn("Service container not found in Docker", {
          serviceId: service.id,
          containerId: service.containerId,
        });

        await this.db.service.update({
          where: { id: service.id },
          data: { status: "ERROR" },
        });

        await this.recordMetric(service, "health_status", 0);
        await this.checkAndFireAlert(
          service.id,
          service.projectId,
          service.name,
          service.engine,
          service.status,
          "ERROR"
        );
      }
      return;
    }

    // Map Docker health/container state to ServiceStatus
    const newStatus = mapDockerHealthToStatus(containerInfo);

    if (newStatus !== service.status) {
      logger.info("Service health status changed", {
        serviceId: service.id,
        from: service.status,
        to: newStatus,
      });

      await this.db.service.update({
        where: { id: service.id },
        data: { status: newStatus },
      });

      await this.recordMetric(service, "health_status", newStatus === "HEALTHY" ? 1 : 0);
      await this.checkAndFireAlert(
        service.id,
        service.projectId,
        service.name,
        service.engine,
        service.status,
        newStatus
      );
    }

    // Collect stats if metrics are enabled and container is running
    if (this.metricsEnabled && containerInfo.state.running) {
      try {
        const stats = await this.runtime.stats(service.containerId);

        if (this.metricsCollector) {
          const records = collectDockerStats({
            containerId: service.containerId,
            serviceId: service.id,
            serviceName: service.name,
            projectId: service.projectId,
            stats,
          });
          this.metricsCollector.recordMany(records);
        } else {
          await this.db.metric.createMany({
            data: [
              {
                sourceType: "SERVICE",
                sourceId: service.id,
                sourceName: service.name,
                metric: "cpu_usage_percent",
                value: stats.cpu.usage,
                unit: "percent",
                projectId: service.projectId,
                serviceId: service.id,
              },
              {
                sourceType: "SERVICE",
                sourceId: service.id,
                sourceName: service.name,
                metric: "memory_usage_bytes",
                value: stats.memory.usage,
                unit: "bytes",
                projectId: service.projectId,
                serviceId: service.id,
              },
              {
                sourceType: "SERVICE",
                sourceId: service.id,
                sourceName: service.name,
                metric: "memory_usage_percent",
                value: stats.memory.percentage,
                unit: "percent",
                projectId: service.projectId,
                serviceId: service.id,
              },
              {
                sourceType: "SERVICE",
                sourceId: service.id,
                sourceName: service.name,
                metric: "network_rx_bytes",
                value: stats.network.rxBytes,
                unit: "bytes",
                projectId: service.projectId,
                serviceId: service.id,
              },
              {
                sourceType: "SERVICE",
                sourceId: service.id,
                sourceName: service.name,
                metric: "network_tx_bytes",
                value: stats.network.txBytes,
                unit: "bytes",
                projectId: service.projectId,
                serviceId: service.id,
              },
              {
                sourceType: "SERVICE",
                sourceId: service.id,
                sourceName: service.name,
                metric: "block_read_bytes",
                value: stats.blockIO.readBytes,
                unit: "bytes",
                projectId: service.projectId,
                serviceId: service.id,
              },
              {
                sourceType: "SERVICE",
                sourceId: service.id,
                sourceName: service.name,
                metric: "block_write_bytes",
                value: stats.blockIO.writeBytes,
                unit: "bytes",
                projectId: service.projectId,
                serviceId: service.id,
              },
            ],
          });
        }
      } catch (err) {
        const isConnectionError = this.isDockerConnectionError(err);
        if (isConnectionError) {
          await this.handleDockerConnectionError();
          return;
        }

        logger.error("Failed to collect service stats", {
          serviceId: service.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
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

  private async handleDockerConnectionError(): Promise<void> {
    this.consecutiveDockerFailures++;

    if (
      this.consecutiveDockerFailures >= this.maxDockerFailuresBeforeUnavailable &&
      this.dockerAvailable
    ) {
      this.dockerAvailable = false;
      logger.warn("Docker appears to be unavailable — pausing health checks until recovery", {
        consecutiveFailures: this.consecutiveDockerFailures,
      });
    }
  }

  private recordMetric(
    service: { id: string; name: string; projectId: string },
    metric: string,
    value: number
  ): void {
    if (this.metricsCollector) {
      this.metricsCollector.record({
        sourceType: "SERVICE",
        sourceId: service.id,
        sourceName: service.name,
        metric,
        value,
        projectId: service.projectId,
        serviceId: service.id,
      });
    } else {
      void this.db.metric.create({
        data: {
          sourceType: "SERVICE",
          sourceId: service.id,
          sourceName: service.name,
          metric,
          value,
          projectId: service.projectId,
          serviceId: service.id,
        },
      });
    }
  }

  private async checkAndFireAlert(
    serviceId: string,
    projectId: string,
    serviceName: string,
    engine: string,
    previousStatus: ServiceStatus,
    newStatus: ServiceStatus
  ): Promise<void> {
    // Only fire alerts on transitions from healthy to unhealthy/error
    if (previousStatus !== "HEALTHY" && previousStatus !== "RUNNING") return;
    if (newStatus !== "UNHEALTHY" && newStatus !== "ERROR") return;

    const rules = await this.db.alertRule.findMany({
      where: {
        projectId,
        enabled: true,
        sourceType: "SERVICE",
      },
      include: { alerts: { where: { status: "FIRING" } } },
    });

    for (const rule of rules) {
      // Don't duplicate firing alerts for the same rule
      if (rule.alerts.length > 0) continue;

      await this.db.alert.create({
        data: {
          ruleId: rule.id,
          status: "FIRING",
          severity: rule.severity,
          value: 0,
          message: `Service "${serviceName}" (${engine}) is ${newStatus}`,
        },
      });

      logger.info("Alert fired for unhealthy service", {
        serviceId,
        ruleId: rule.id,
        severity: rule.severity,
      });
    }
  }
}

function mapDockerHealthToStatus(containerInfo: ContainerInfo): ServiceStatus {
  // Container not running at all
  if (!containerInfo.state.running) {
    return "STOPPED";
  }

  // Check Docker health check status
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
      // No health check configured — assume healthy if running
      return "RUNNING";
  }
}
