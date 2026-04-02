import {
  SERVICE_KEY_STRINGS,
  type ServiceContainer,
  type ServiceModule,
  type ConfigService,
} from "@forge/core";
import { PrismaClient } from "@forge/database";
import { SecretService } from "../services/secret.service.js";

export class SecretModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.SECRET_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      const configService = container.resolveSync<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
      return new SecretService(db, configService.getConfig());
    });
  }
}
