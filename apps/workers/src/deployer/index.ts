/**
 * Deployer worker entry point
 *
 * Runs the deployer worker that processes deployment jobs from the queue.
 * This worker is responsible for:
 * - Creating containers from built images
 * - Starting containers and monitoring health
 * - Updating deployment status based on container health
 */

import "dotenv/config";
import pino from "pino";
import { DeployerWorker } from "./worker.js";

const logger = pino({
  name: "forge-deployer-worker",
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
  logger.info("Starting Forge Deployer Worker...");

  const queueConfig = getQueueConfig();
  logger.info(
    { redis: { host: queueConfig.redis.host, port: queueConfig.redis.port } },
    "Connecting to Redis..."
  );

  const worker = new DeployerWorker(queueConfig, {
    concurrency: Number.parseInt(process.env.DEPLOYER_CONCURRENCY ?? "5", 10),
  });

  logger.info("Deployer worker started and ready to process jobs");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Received shutdown signal");
    await worker.close();
    logger.info("Deployer worker stopped gracefully");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ error }, "Failed to start deployer worker");
  process.exit(1);
});
