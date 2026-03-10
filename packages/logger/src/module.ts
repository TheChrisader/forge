/**
 * Logger Module
 *
 * Dependency injection module for the logger service.
 * Follows the Forge platform DI pattern established by @forge/cache and @forge/queue.
 *
 * Unlike CacheModule which requires config in constructor, LoggerModule reads
 * config from the ConfigService during registration.
 */

import type { ServiceContainer } from "@forge/core";
import type { ServiceModule } from "@forge/core";
import type { ConfigService } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import type { LoggerConfig } from "./types";
import { LoggerService } from "./logger.service";

/**
 * Logger Module
 *
 * Registers the LoggerService as a singleton in the DI container.
 * Configuration is read from the ConfigService during registration.
 */
export class LoggerModule implements ServiceModule {
  /**
   * Register the logger service with the DI container
   * @param container - Service container
   */
  async register(container: ServiceContainer): Promise<void> {
    // Resolve ConfigService to get logger configuration
    const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
    const config = configService.getConfig();

    // Create logger configuration from observability config
    const loggerConfig: LoggerConfig = {
      level: config.observability.logs.level,
      format: config.observability.logs.format,
      enabled: config.observability.logs.enabled,
      name: "forge-api",
    };

    // Register LoggerService as a singleton
    container.singleton(SERVICE_KEY_STRINGS.LOGGER, () => {
      return new LoggerService(loggerConfig);
    });
  }
}

/**
 * Dispose of the logger module
 * Flushes any buffered logs before shutdown
 * @param container - Service container
 */
export async function disposeLoggerModule(container: ServiceContainer): Promise<void> {
  if (container.has(SERVICE_KEY_STRINGS.LOGGER)) {
    const logger = await container.resolve<LoggerService>(SERVICE_KEY_STRINGS.LOGGER);
    if (logger.flush) {
      await logger.flush();
    }
  }
}
