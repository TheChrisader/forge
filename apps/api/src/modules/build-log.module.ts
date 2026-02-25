import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import type { PrismaClient } from "@forge/database";
import { BuildLogService } from "@forge/core";

/**
 * BuildLogModule - Registers the BuildLogService in the DI container
 *
 * The BuildLogService manages durable storage and querying of build logs
 * using TimescaleDB's hypertable for efficient time-series storage.
 */
export class BuildLogModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.LOG_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new BuildLogService(db);
    });
  }
}
