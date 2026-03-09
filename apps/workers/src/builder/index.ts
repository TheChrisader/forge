import "dotenv/config";
import pino from "pino";
import { BuildWorker } from "./worker.js";
import { registerDefaultStrategies } from "@forge/build";
import { startCleanupJob } from "./jobs/cleanup.job.js";
import { ServiceRegistry, DatabaseModule } from "@forge/core";
import { QueueConfig } from "@forge/queue";

const logger = pino({
  name: "forge-build-worker",
  level: process.env.LOG_LEVEL ?? "info",
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

  // Pre-pull required Docker images (e.g., nixpacks)
  // await initBuildWorker();

  const queueConfig = getQueueConfig();
  logger.info(
    {
      redis: { host: queueConfig.connection.redis?.host, port: queueConfig.connection.redis?.port },
    },
    "Connecting to Redis..."
  );

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
    logger.info({ signal }, "Received shutdown signal");
    await worker.close();
    logger.info("Build worker stopped gracefully");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ error }, "Failed to start build worker");
  process.exit(1);
});
