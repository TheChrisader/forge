import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ServiceContainer } from "./container";

describe("ServiceContainer", () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe("Singleton Services", () => {
    it("should return the same instance for singleton services", async () => {
      let counter = 0;

      container.singleton("counter", () => ({
        value: ++counter,
      }));

      const instance1 = await container.resolve<{ value: number }>("counter");
      const instance2 = await container.resolve<{ value: number }>("counter");

      expect(instance1).toBe(instance2);
      expect(instance1.value).toBe(1);
      expect(counter).toBe(1);
    });

    it("should cache singleton instances", async () => {
      let created = 0;

      container.singleton("service", () => {
        created++;
        return { id: created };
      });

      await container.resolve("service");
      await container.resolve("service");
      await container.resolve("service");

      expect(created).toBe(1);
    });
  });

  describe("Transient Services", () => {
    it("should return new instances for transient services", async () => {
      let counter = 0;

      container.transient("counter", () => ({
        value: ++counter,
      }));

      const instance1 = await container.resolve<{ value: number }>("counter");
      const instance2 = await container.resolve<{ value: number }>("counter");

      expect(instance1).not.toBe(instance2);
      expect(instance1.value).toBe(1);
      expect(instance2.value).toBe(2);
    });
  });

  describe("Instance Registration", () => {
    it("should register existing instances", async () => {
      const instance = { value: 42 };

      container.instance("myService", instance);

      const resolved = await container.resolve<typeof instance>("myService");

      expect(resolved).toBe(instance);
      expect(resolved.value).toBe(42);
    });
  });

  describe("Async Factories", () => {
    it("should handle async factory functions", async () => {
      container.singleton("asyncService", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ready: true };
      });

      const service = await container.resolve<{ ready: boolean }>("asyncService");

      expect(service.ready).toBe(true);
    });

    it("should throw when using resolveSync with async factory", () => {
      container.singleton("asyncService", async () => {
        return { ready: true };
      });

      expect(() => container.resolveSync("asyncService")).toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should throw when service not found", async () => {
      await expect(container.resolve("nonexistent")).rejects.toThrow(
        "Service not found: nonexistent"
      );
    });

    it("should throw when registering duplicate service", () => {
      container.singleton("duplicate", () => ({}));

      expect(() => {
        container.singleton("duplicate", () => ({}));
      }).toThrow("Service already registered: duplicate");
    });

    it("should detect circular dependencies", async () => {
      container.singleton("a", async () => {
        await container.resolve("b");
        return {};
      });

      container.singleton("b", async () => {
        await container.resolve("a");
        return {};
      });

      await expect(container.resolve("a")).rejects.toThrow("Circular dependency detected");
    });
  });

  describe("Lifecycle Management", () => {
    it("should call dispose on services during cleanup", async () => {
      const disposeSpy = vi.fn();

      container.singleton("service", () => ({
        dispose: disposeSpy,
      }));

      await container.resolve("service");
      await container.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it("should call close on services during cleanup", async () => {
      const closeSpy = vi.fn();

      container.singleton("service", () => ({
        close: closeSpy,
      }));

      await container.resolve("service");
      await container.dispose();

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should call cleanup on services during cleanup", async () => {
      const cleanupSpy = vi.fn();

      container.singleton("service", () => ({
        cleanup: cleanupSpy,
      }));

      await container.resolve("service");
      await container.dispose();

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should clear all instances", async () => {
      let created = 0;

      container.singleton("service", () => ({
        id: ++created,
      }));

      const instance1 = await container.resolve<{ id: number }>("service");
      expect(instance1.id).toBe(1);

      container.clearInstances();

      const instance2 = await container.resolve<{ id: number }>("service");
      expect(instance2.id).toBe(2);
    });
  });

  describe("Utility Methods", () => {
    it("should check if service exists", () => {
      container.singleton("exists", () => ({}));

      expect(container.has("exists")).toBe(true);
      expect(container.has("doesNotExist")).toBe(false);
    });

    it("should list all service keys", () => {
      container.singleton("service1", () => ({}));
      container.singleton("service2", () => ({}));
      container.singleton("service3", () => ({}));

      const keys = container.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain("service1");
      expect(keys).toContain("service2");
      expect(keys).toContain("service3");
    });

    it("should unregister services", () => {
      container.singleton("service", () => ({}));
      expect(container.has("service")).toBe(true);

      container.unregister("service");
      expect(container.has("service")).toBe(false);
    });

    it("should clear all services", () => {
      container.singleton("service1", () => ({}));
      container.singleton("service2", () => ({}));

      expect(container.has("service1")).toBe(true);
      expect(container.has("service2")).toBe(true);

      container.clear();

      expect(container.has("service1")).toBe(false);
      expect(container.has("service2")).toBe(false);
    });
  });
});
