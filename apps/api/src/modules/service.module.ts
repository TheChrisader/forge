import {
  SERVICE_KEY_STRINGS,
  type ServiceContainer,
  type ServiceModule,
  type ConfigService,
} from "@forge/core";
import { PrismaClient } from "@forge/database";
import { QueueService } from "@forge/queue";
import type { DockerRuntime } from "@forge/docker";
import { SSEManagerService } from "../services/sse-manager.service.js";
import { ServiceService } from "../services/service.service.js";

export class ServiceManagerModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.SERVICE_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      const queueService = container.resolveSync<QueueService>(SERVICE_KEY_STRINGS.QUEUE);
      const configService = container.resolveSync<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
      const sseManager = container.resolveSync<SSEManagerService>(SERVICE_KEY_STRINGS.SSE_MANAGER);
      const runtime = container.resolveSync<DockerRuntime>(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME);
      const config = configService.getConfig();

      const encryptionKey = config.security.secrets.encryptionKey;

      if (!encryptionKey) {
        throw new Error(
          "Secret encryption key is not configured. Set SECRETS_ENCRYPTION_KEY to a string of at least 32 characters."
        );
      }

      return new ServiceService(db, queueService, encryptionKey, sseManager, runtime);
    });
  }
}
