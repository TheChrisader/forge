import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { DockerRuntime } from "@forge/docker";
import type { PrismaClient } from "@forge/database";
import type { ILogger, TerminalConfig } from "@forge/core";
import { TerminalService } from "../services/terminal.service.js";

/**
 * TerminalModule - Registers the TerminalService for interactive container terminals.
 *
 * The TerminalService manages WebSocket-backed terminal sessions, including
 * session lifecycle, idle timeouts, and per-user limits.
 */
export class TerminalModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.TERMINAL_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      const runtime = container.resolveSync<DockerRuntime>(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME);
      const logger = container.resolveSync<ILogger>(SERVICE_KEY_STRINGS.LOGGER);

      let terminalConfig: Partial<TerminalConfig> | undefined;
      try {
        const configService = container.resolveSync<{
          getConfig: () => { terminal?: TerminalConfig };
        }>(SERVICE_KEY_STRINGS.CONFIG);
        terminalConfig = configService.getConfig().terminal;
      } catch {
        // Config not yet available; use defaults
      }

      return new TerminalService(db, runtime, logger, terminalConfig);
    });
  }
}
