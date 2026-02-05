export type ServiceFactory<T> = () => T | Promise<T>;
export type ServiceScope = "singleton" | "transient";

export interface ServiceRegistration<T> {
  factory: ServiceFactory<T>;
  scope: ServiceScope;
  instance?: T;
}

export class ServiceContainer {
  private services = new Map<string, ServiceRegistration<any>>();
  private resolving = new Set<string>();

  register<T>(key: string, factory: ServiceFactory<T>, scope: ServiceScope = "singleton"): void {
    if (this.services.has(key)) {
      throw new Error(`Service already registered: ${key}`);
    }

    this.services.set(key, {
      factory,
      scope,
    });
  }

  singleton<T>(key: string, factory: ServiceFactory<T>): void {
    this.register(key, factory, "singleton");
  }

  transient<T>(key: string, factory: ServiceFactory<T>): void {
    this.register(key, factory, "transient");
  }

  instance<T>(key: string, instance: T): void {
    if (this.services.has(key)) {
      throw new Error(`Service already registered: ${key}`);
    }

    this.services.set(key, {
      factory: () => instance,
      scope: "singleton",
      instance,
    });
  }

  async resolve<T>(key: string): Promise<T> {
    const registration = this.services.get(key);

    if (!registration) {
      throw new Error(`Service not found: ${key}`);
    }

    if (this.resolving.has(key)) {
      throw new Error(`Circular dependency detected: ${key}`);
    }

    if (registration.scope === "singleton" && registration.instance) {
      return registration.instance as T;
    }

    this.resolving.add(key);

    try {
      const instance = await registration.factory();

      if (registration.scope === "singleton") {
        registration.instance = instance;
      }

      return instance as T;
    } finally {
      this.resolving.delete(key);
    }
  }

  resolveSync<T>(key: string): T {
    const registration = this.services.get(key);

    if (!registration) {
      throw new Error(`Service not found: ${key}`);
    }

    if (this.resolving.has(key)) {
      throw new Error(`Circular dependency detected: ${key}`);
    }

    if (registration.scope === "singleton" && registration.instance) {
      return registration.instance as T;
    }

    this.resolving.add(key);

    try {
      const instance = registration.factory();

      if (instance instanceof Promise) {
        throw new Error(
          `Cannot synchronously resolve async factory: ${key}. Use resolve() instead.`
        );
      }

      if (registration.scope === "singleton") {
        registration.instance = instance;
      }

      return instance as T;
    } finally {
      this.resolving.delete(key);
    }
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  unregister(key: string): void {
    this.services.delete(key);
  }

  clear(): void {
    this.services.clear();
  }

  clearInstances(): void {
    for (const registration of this.services.values()) {
      registration.instance = undefined;
    }
  }

  keys(): string[] {
    return Array.from(this.services.keys());
  }

  async dispose(): Promise<void> {
    for (const registration of this.services.values()) {
      if (registration.instance && typeof registration.instance === "object") {
        const instance = registration.instance as any;

        if (typeof instance.dispose === "function") {
          await instance.dispose();
        } else if (typeof instance.close === "function") {
          await instance.close();
        } else if (typeof instance.cleanup === "function") {
          await instance.cleanup();
        }
      }
    }

    this.clear();
  }
}
