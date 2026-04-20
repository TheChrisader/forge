import "dotenv/config";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { ServiceProvisionerWorker } from "./worker.js";
import type { QueueConfig } from "@forge/queue";
import { ServiceHealthMonitor } from "../service-health-monitor.js";
import { BackupScheduler } from "../backup-scheduler.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "forge-service-provisioner",
});

function getQueueConfig(): QueueConfig {
  return {
    connection: {
      type: "redis",
      redis: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
        password: process.env.REDIS_PASSWORD,
        db: Number.parseInt(process.env.REDIS_DB ?? "0", 10),
      },
    },
  };
}

async function main(): Promise<void> {
  logger.info("Starting Forge Service Provisioner Worker...");

  const queueConfig = getQueueConfig();
  logger.info("Connecting to Redis...", {
    redis: { host: queueConfig.connection.redis?.host, port: queueConfig.connection.redis?.port },
  });

  const worker = new ServiceProvisionerWorker(queueConfig, {
    concurrency: Number.parseInt(process.env.SERVICE_CONCURRENCY ?? "3", 10),
  });

  await worker.initialize();

  // Start health monitor
  const healthMonitor = new ServiceHealthMonitor({
    pollIntervalMs: parseInt(process.env.SERVICE_HEALTH_POLL_INTERVAL_MS ?? "30000", 10),
    metricsEnabled: process.env.SERVICE_HEALTH_METRICS_ENABLED !== "false",
  });

  await healthMonitor.start();

  // Start backup scheduler
  const backupScheduler = new BackupScheduler(queueConfig, {
    checkIntervalMs: parseInt(process.env.BACKUP_SCHEDULER_INTERVAL_MS ?? "60000", 10),
  });

  backupScheduler.start();

  logger.info("Service provisioner worker started and ready to process jobs");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Received shutdown signal", { signal });
    await backupScheduler.stop();
    await healthMonitor.stop();
    await worker.close();
    logger.info("All service workers stopped gracefully");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("Failed to start service provisioner worker", { error });
  process.exit(1);
});
