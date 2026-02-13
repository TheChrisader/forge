import pino from "pino";
import "pino-pretty";
import type { ServiceContainer, ServiceModule, ConfigService } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";

interface LoggerOptions {
  level: string;
  pretty: boolean;
  format: "json" | "pretty";
}

export class LoggerModule implements ServiceModule {
  private logger?: pino.Logger;

  async register(container: ServiceContainer): Promise<void> {
    const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
    const config = configService.getConfig();

    const options: LoggerOptions = {
      level: config.observability.logs.level,
      pretty: config.observability.logs.format === "pretty",
      format: config.observability.logs.format,
    };

    const logger = pino(
      options.pretty
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            },
          }
        : {
            level: options.level,
          }
    );

    this.logger = logger;
    container.singleton(SERVICE_KEY_STRINGS.LOGGER, () => logger);
  }

  getLogger(): pino.Logger | undefined {
    return this.logger;
  }
}
