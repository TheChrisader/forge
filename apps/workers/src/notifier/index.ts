import "dotenv/config";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { NotificationWorker } from "./worker.js";
import type { QueueConfig } from "@forge/queue";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "INFO",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "forge-notification-worker",
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
  logger.info("Starting Forge Notification Worker...");

  const queueConfig = getQueueConfig();
  logger.info("Connecting to Redis...", {
    redis: { host: queueConfig.connection.redis?.host, port: queueConfig.connection.redis?.port },
  });

  const worker = new NotificationWorker(queueConfig, {
    concurrency: Number.parseInt(process.env.WORKER_CONCURRENCY ?? "10", 10),
    lockDuration: Number.parseInt(process.env.WORKER_LOCK_DURATION_MS ?? "300000", 10),
  });

  logger.info("Notification worker started and ready to process jobs");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Received shutdown signal", { signal });
    await worker.close();
    logger.info("Notification worker stopped gracefully");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("Failed to start notification worker", { error });
  process.exit(1);
});
