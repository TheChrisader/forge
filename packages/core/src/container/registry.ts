import { ServiceContainer } from "./container";
import type { IInitializable } from "./interfaces";

export interface ServiceModule {
  register(container: ServiceContainer): void | Promise<void>;
}

export class ServiceRegistry {
  private container: ServiceContainer;
  private modules = new Map<string, ServiceModule>();
  private initialized = false;

  constructor() {
    this.container = new ServiceContainer();
  }

  registerModule(name: string, module: ServiceModule): void {
    if (this.modules.has(name)) {
      throw new Error(`Module already registered: ${name}`);
    }

    this.modules.set(name, module);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error("Registry already initialized");
    }

    for (const [name, module] of this.modules.entries()) {
      try {
        await module.register(this.container);
      } catch (error) {
        throw new Error(`Failed to register module ${name}: ${error}`);
      }
    }

    for (const key of this.container.keys()) {
      const service = await this.container.resolve<any>(key);

      if (this.isInitializable(service)) {
        await service.initialize();
      }
    }

    this.initialized = true;
  }

  async dispose(): Promise<void> {
    await this.container.dispose();
    this.modules.clear();
    this.initialized = false;
  }

  getContainer(): ServiceContainer {
    return this.container;
  }

  async resolve<T>(key: string): Promise<T> {
    if (!this.initialized) {
      throw new Error("Registry not initialized. Call initialize() first.");
    }

    return this.container.resolve<T>(key);
  }

  private isInitializable(obj: any): obj is IInitializable {
    return obj && typeof obj.initialize === "function";
  }
}
