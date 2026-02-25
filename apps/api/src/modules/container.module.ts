import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { DockerRuntime } from "@forge/docker";

/**
 * ContainerModule - Registers the DockerRuntime in the DI container
 *
 * The DockerRuntime provides methods for managing Docker containers,
 * images, volumes, and networks.
 */
export class ContainerModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME, () => {
      return new DockerRuntime();
    });
  }
}
