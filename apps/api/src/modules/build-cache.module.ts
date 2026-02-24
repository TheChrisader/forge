import { SERVICE_KEY_STRINGS, ServiceContainer, ServiceModule } from "@forge/core";
import { PrismaClient } from "@forge/database";
import { BuildCacheService } from "@forge/docker";

/**
 * BuildCacheModule registers the build cache service with the DI container
 */
export class BuildCacheModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.BUILD_CACHE_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new BuildCacheService(db);
    });
  }
}
