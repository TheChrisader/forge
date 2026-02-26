import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { DockerRuntime } from "@forge/docker";
import type { PrismaClient } from "@forge/database";
import { ContainerService } from "../services/container.service";
import { NetworkManager } from "../services/network-manager";
import { VolumeManager } from "../services/volume-manager";

/**
 * ContainerModule - Registers the ContainerService and dependencies
 *
 * The ContainerService provides business logic for managing Docker containers,
 * including lifecycle management, database synchronization, and integration
 * with network and volume managers.
 */
export class ContainerModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.CONTAINER_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      const runtime = container.resolveSync<DockerRuntime>(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME);

      const networkManager = new NetworkManager(runtime, db);
      const volumeManager = new VolumeManager(runtime, db);

      return new ContainerService(db, runtime, networkManager, volumeManager);
    });
  }
}
