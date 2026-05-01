import { SERVICE_KEY_STRINGS, ServiceContainer, ServiceModule } from "@forge/core";
import { PrismaClient } from "@forge/database";
import { QueueService } from "@forge/queue";
import { DeploymentService } from "../services/deployment.service.js";

export class DeploymentModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.DEPLOYMENT_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      const queueService = container.resolveSync<QueueService>(SERVICE_KEY_STRINGS.QUEUE);
      return new DeploymentService(db, queueService);
    });
  }
}
