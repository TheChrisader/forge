import "dotenv/config";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { BuildWorker } from "./worker.js";
import { registerDefaultStrategies } from "@forge/build";
import { startCleanupJob } from "./jobs/cleanup.job.js";
import { ServiceRegistry, DatabaseModule } from "@forge/core";
import { QueueConfig } from "@forge/queue";
import { DockerRuntime } from "@forge/docker";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "forge-build-worker",
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
  logger.info("Starting Forge Build Worker...");

  registerDefaultStrategies();
  logger.info("Build strategies registered");

  const runtime = new DockerRuntime();
  await runtime.createVolume({
    name: "forge-nixpacks-cache",
    labels: { "forge.managed": "true", "forge.purpose": "nixpacks-build-cache" },
  });
  logger.info("Nixpacks build cache volume ready");

  const queueConfig = getQueueConfig();
  logger.info("Connecting to Redis...", {
    redis: { host: queueConfig.connection.redis?.host, port: queueConfig.connection.redis?.port },
  });

  const worker = new BuildWorker(queueConfig, {
    concurrency: Number.parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10),
    // Lock duration must exceed maximum build time (30 min Docker build + 5 min git clone + buffer)
    lockDuration: Number.parseInt(process.env.WORKER_LOCK_DURATION_MS ?? "2400000", 10), // 40 minutes
  });

  logger.info("Build worker started and ready to process jobs");

  const registry = new ServiceRegistry();
  registry.registerModule("database", new DatabaseModule());
  await registry.initialize();
  logger.info("Cleanup job container initialized");

  startCleanupJob(registry.getContainer());
  logger.info("Cleanup job started");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Received shutdown signal", { signal });
    await worker.close();
    logger.info("Build worker stopped gracefully");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("Failed to start build worker", { error });
  process.exit(1);
});
