import "dotenv/config";
import pino from "pino";
import { BuildWorker } from "./worker.js";
import { registerDefaultStrategies } from "@forge/build";
import { startCleanupJob } from "./jobs/cleanup.job.js";
import { ServiceRegistry, DatabaseModule } from "@forge/core";

const logger = pino({
  name: "forge-build-worker",
  level: process.env.LOG_LEVEL ?? "info",
});

function getQueueConfig(): {
  redis: { host: string; port: number; password?: string; db: number };
} {
  return {
    redis: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
      password: process.env.REDIS_PASSWORD,
      db: Number.parseInt(process.env.REDIS_DB ?? "0", 10),
    },
  };
}

async function main(): Promise<void> {
  logger.info("Starting Forge Build Worker...");

  registerDefaultStrategies();
  logger.info("Build strategies registered");

  const queueConfig = getQueueConfig();
  logger.info(
    { redis: { host: queueConfig.redis.host, port: queueConfig.redis.port } },
    "Connecting to Redis..."
  );

  const worker = new BuildWorker(queueConfig, {
    concurrency: Number.parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10),
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
