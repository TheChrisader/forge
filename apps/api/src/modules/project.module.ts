import { SERVICE_KEY_STRINGS, ServiceContainer, ServiceModule } from "@forge/core";
import { PrismaClient } from "@forge/database";
import { ProjectService } from "../services/project.service.js";

export class ProjectModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.PROJECT_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new ProjectService(db);
    });
  }
}
