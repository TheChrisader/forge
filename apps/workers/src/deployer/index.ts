import "dotenv/config";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { DeployerWorker } from "./worker.js";
import { QueueConfig } from "@forge/queue";
import { DeploymentHealthMonitor } from "./deployment-health-monitor.js";
import { MetricsCollector } from "@forge/observability";
import { getDatabaseClient } from "@forge/database";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "forge-deployer-worker",
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
  logger.info("Starting Forge Deployer Worker...");

  const queueConfig = getQueueConfig();
  logger.info("Connecting to Redis...", {
    redis: { host: queueConfig.connection.redis?.host, port: queueConfig.connection.redis?.port },
  });

  const worker = new DeployerWorker(queueConfig, {
    concurrency: Number.parseInt(process.env.DEPLOYER_CONCURRENCY ?? "5", 10),
  });

  await worker.initialize();

  // Shared metrics collector for deployment health monitoring
  const metricsLogger = new LoggerService({
    level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    format: process.env.NODE_ENV === "development" ? "pretty" : "json",
    enabled: true,
    name: "deployer-metrics",
  });
  const db = getDatabaseClient();
  const metricsCollector = new MetricsCollector(db, metricsLogger);

  const healthMonitor = new DeploymentHealthMonitor({
    pollIntervalMs: Number.parseInt(process.env.DEPLOYMENT_HEALTH_POLL_INTERVAL_MS ?? "15000", 10),
    metricsCollector,
  });

  await healthMonitor.start();

  logger.info("Deployer worker started and ready to process jobs");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Received shutdown signal", { signal });
    await healthMonitor.stop();
    await worker.close();
    logger.info("Deployer worker stopped gracefully");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("Failed to start deployer worker", { error });
  process.exit(1);
});
