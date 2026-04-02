import { SERVICE_KEY_STRINGS, ServiceContainer, ServiceModule } from "@forge/core";
import { PrismaClient } from "@forge/database";
import { EnvironmentVariableService } from "../services/environment-variable.service.js";

export class EnvironmentVariableModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.ENVIRONMENT_VARIABLE_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new EnvironmentVariableService(db);
    });
  }
}
