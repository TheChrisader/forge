/**
 * Storage module for ServiceRegistry
 * Registers the LocalStorageProvider
 */

import type { ServiceContainer, ServiceModule } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { LocalStorageProvider } from "@forge/storage";

export class StorageModule implements ServiceModule {
  register(container: ServiceContainer): void {
    const storagePath = process.env.FORGE_STORAGE_PATH ?? "./data/storage";
    const storage = new LocalStorageProvider(storagePath);

    container.singleton(SERVICE_KEY_STRINGS.STORAGE, () => storage);
    container.singleton(SERVICE_KEY_STRINGS.STORAGE_FACTORY, () => storage);
  }
}
