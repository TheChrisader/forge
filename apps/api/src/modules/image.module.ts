import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { DockerRuntime } from "@forge/docker";

/**
 * ImageModule - Registers the DockerRuntime for image operations
 *
 * The DockerRuntime provides low-level methods for managing Docker images,
 * which are used by the image management routes.
 */
export class ImageModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME, () => {
      return new DockerRuntime();
    });
  }
}
