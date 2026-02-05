import type { ServiceContainer } from "../container/container";
import type { ServiceModule } from "../container/registry";
import { SERVICE_KEY_STRINGS } from "../container/keys";
import { getDatabaseClient } from "@forge/database";

export class DatabaseModule implements ServiceModule {
  async register(container: ServiceContainer): Promise<void> {
    container.singleton(SERVICE_KEY_STRINGS.DATABASE, () => {
      return getDatabaseClient();
    });
  }
}
