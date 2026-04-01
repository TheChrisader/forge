import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { PermissionsService, SessionService, InvitationService } from "@forge/auth";
import type { PrismaClient } from "@forge/database";
import type Redis from "ioredis";

export class AuthModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.PERMISSIONS_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      const redis = container.resolveSync<Redis>(SERVICE_KEY_STRINGS.CACHE);
      return new PermissionsService(db, redis);
    });

    container.singleton(SERVICE_KEY_STRINGS.SESSION_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new SessionService(db);
    });

    container.singleton(SERVICE_KEY_STRINGS.INVITATION_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new InvitationService(db);
    });
  }
}
