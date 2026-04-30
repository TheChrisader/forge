import type { ServiceContainer } from "../container/container";
import type { ServiceModule } from "../container/registry";
import { SERVICE_KEY_STRINGS } from "../container/keys";
import { ConfigService } from "../config/service";

export class ConfigModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.CONFIG, () => {
      return new ConfigService();
    });
  }
}
