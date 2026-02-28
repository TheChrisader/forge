/**
 * SSE Module
 *
 * Registers the generic SSE Manager service for Server-Sent Events.
 *
 * This module only provides the infrastructure - domain-specific
 * event subscriptions (like deployment logs) are handled in their
 * respective modules to maintain proper separation of concerns.
 */

import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { SSEManagerService } from "../services/sse-manager.service.js";

export class SSEModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.SSE_MANAGER, () => {
      return new SSEManagerService();
    });
  }
}
