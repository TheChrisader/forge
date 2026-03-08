/**
 * SSE Module
 *
 * Registers the generic SSE Manager service for Server-Sent Events.
 *
 * This module only provides the infrastructure - domain-specific
 * event subscriptions (like deployment logs) are handled in their
 * respective modules to maintain proper separation of concerns.
 */

import {
  SERVICE_KEY_STRINGS,
  type ServiceContainer,
  type ServiceModule,
  type ConfigService,
  type SSEConfig,
} from "@forge/core";
import { SSEManagerService } from "../services/sse-manager.service.js";
import { MessageBatcherService } from "../services/message-batcher.service.js";

export class SSEModule implements ServiceModule {
  async register(container: ServiceContainer): Promise<void> {
    const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
    const config = configService.getConfig();

    // Check if SSE config exists and is enabled
    if (!config.sse || !config.sse.enabled) {
      // SSE disabled - register a service that throws on usage
      const disabledConfig: SSEConfig = {
        enabled: false,
        maxConnectionsPerTopic: 0,
        maxTotalConnections: 0,
        connectionTimeoutMs: 0,
        heartbeatIntervalMs: 0,
        batchThreshold: 0,
        batchWindowMs: 0,
        batchMaxSize: 0,
      };
      container.singleton(SERVICE_KEY_STRINGS.SSE_MANAGER, () => {
        return new SSEManagerService(disabledConfig, undefined);
      });
      return;
    }

    const sseConfig = config.sse;

    // Register MessageBatcherService first (dependency of SSEManagerService)
    container.singleton(SERVICE_KEY_STRINGS.MESSAGE_BATCHER, () => {
      return new MessageBatcherService({
        windowMs: sseConfig.batchWindowMs,
        maxSize: sseConfig.batchMaxSize,
      });
    });

    // Register SSEManagerService with config and batcher
    container.singleton(SERVICE_KEY_STRINGS.SSE_MANAGER, () => {
      const batcher = container.resolveSync<MessageBatcherService>(
        SERVICE_KEY_STRINGS.MESSAGE_BATCHER
      );
      return new SSEManagerService(sseConfig, batcher);
    });
  }
}
