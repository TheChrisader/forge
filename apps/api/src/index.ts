import pino from "pino";
import { loadConfig } from "./config/loader.js";
import { createServer } from "./server.js";

const logger = pino({ level: "info" });

async function main(): Promise<void> {
  try {
    const config = loadConfig();

    logger.info(
      {
        port: config.server.port,
        host: config.server.host,
        env: config.nodeEnv,
      },
      "Starting Forge API server"
    );

    const server = await createServer();

    const shutdown = async (signal: string): Promise<void> => {
      logger.info({ signal }, "Received shutdown signal");

      try {
        await server.close();
        logger.info("Server closed successfully");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
      }
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));

    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(
      {
        port: config.server.port,
        host: config.server.host,
        docs: `http://${config.server.host}:${config.server.port}/docs`,
      },
      "Server ready"
    );
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

void main();
