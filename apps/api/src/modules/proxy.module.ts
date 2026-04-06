import {
  SERVICE_KEY_STRINGS,
  type ServiceContainer,
  type ServiceModule,
  type ConfigService,
  type ILogger,
} from "@forge/core";
import { PrismaClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import { ReverseProxyFactory, type ProxyProvider } from "@forge/proxy";
import { ProxyManagerService } from "../services/proxy-manager.service.js";

export class ProxyModule implements ServiceModule {
  async register(container: ServiceContainer): Promise<void> {
    container.singleton(SERVICE_KEY_STRINGS.REVERSE_PROXY_FACTORY, () => {
      const runtime = container.resolveSync<DockerRuntime>(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME);
      return new ReverseProxyFactory(runtime);
    });

    const configService = container.resolveSync<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
    const config = configService.getConfig();

    const factory = container.resolveSync<ReverseProxyFactory>(
      SERVICE_KEY_STRINGS.REVERSE_PROXY_FACTORY
    );
    const provider: ProxyProvider = await factory.createProvider({
      type: config.proxy.provider,
      ...config.proxy,
      dockerSocketPath: config.docker.socketPath,
    });

    container.instance(SERVICE_KEY_STRINGS.PROXY_INTEGRATION, provider.integration);
    container.instance(
      SERVICE_KEY_STRINGS.REVERSE_PROXY,
      new ProxyManagerService(
        provider.proxy,
        provider.integration,
        container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE),
        container.resolveSync<ILogger>(SERVICE_KEY_STRINGS.LOGGER),
        config.proxy.provider
      )
    );
  }
}
