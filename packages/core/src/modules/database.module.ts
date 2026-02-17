import type { ServiceContainer } from "../container/container";
import type { ServiceModule } from "../container/registry";
import { SERVICE_KEY_STRINGS } from "../container/keys";
import { getDatabaseClient, closeDatabaseClient } from "@forge/database";

export class DatabaseModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.DATABASE, () => {
      return getDatabaseClient();
    });
  }
}

export async function disposeDatabaseModule(container: ServiceContainer): Promise<void> {
  if (container.has(SERVICE_KEY_STRINGS.DATABASE)) {
    await closeDatabaseClient();
  }
}
