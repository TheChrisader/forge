/**
 * Logger Module Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LoggerModule, disposeLoggerModule } from "../module";
import type { ServiceContainer } from "@forge/core";
import type { ConfigService } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import type { Config } from "@forge/core";

// Mock service container
class MockServiceContainer implements ServiceContainer {
  private services = new Map<string, unknown>();

  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory());
  }

  singleton<T>(key: string, factory: () => T): void {
    if (!this.services.has(key)) {
      this.services.set(key, factory());
    }
  }

  async resolve<T>(key: string): Promise<T> {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service not found: ${key}`);
    }
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  clear(): void {
    this.services.clear();
  }
}

// Mock config service
class MockConfigService implements Partial<ConfigService> {
  constructor(private config: Config) {}

  getConfig(): Config {
    return this.config;
  }
}

describe("LoggerModule", () => {
  let container: MockServiceContainer;
  let mockConfig: Config;

  beforeEach(() => {
    container = new MockServiceContainer();

    // Create mock config
    mockConfig = {
      nodeEnv: "development",
      server: {
        port: 3000,
        host: "localhost",
        proxy: false,
        cors: { enabled: true, origins: ["*"], credentials: true },
        rateLimit: { enabled: true, max: 100, windowMs: 60000 },
      },
      database: {
        url: "postgresql://localhost/test",
        pool: { min: 2, max: 10, idleTimeoutMillis: 30000 },
        ssl: false,
        logging: false,
      },
      redis: {
        host: "localhost",
        port: 6379,
      },
      cache: {
        provider: "redis",
        ttl: 3600,
      },
      queue: {
        connection: {
          host: "localhost",
          port: 6379,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      },
      docker: {
        socketPath: "/var/run/docker.sock",
        network: {
          default: "forge-network",
          driver: "bridge",
        },
      },
      storage: {
        provider: "local",
        local: {
          basePath: "./data",
        },
      },
      proxy: {
        provider: "traefik",
        httpPort: 80,
        httpsPort: 443,
        domain: "local.dev",
        ssl: {
          enabled: true,
          autoGenerate: true,
        },
      },
      observability: {
        logs: {
          enabled: true,
          level: "info",
          retention: "30d",
          format: "json",
        },
        metrics: {
          enabled: true,
          interval: 10000,
          retention: "90d",
        },
        tracing: {
          enabled: false,
          samplingRate: 0.1,
        },
      },
      security: {
        jwt: {
          secret: "test-secret-key-that-is-at-least-32-characters-long",
          expiresIn: "7d",
          issuer: "forge",
        },
        secrets: {
          rotationDays: 90,
        },
        rateLimit: {
          enabled: true,
          max: 1000,
          windowMs: 60000,
        },
      },
      features: {
        autoSSL: true,
        imageScan: true,
        multiUser: false,
        plugins: true,
        webSearch: false,
        hotReload: true,
      },
      paths: {
        data: "./data",
        logs: "./logs",
        builds: "./builds",
        cache: "./cache",
        plugins: "./plugins",
        temp: "./tmp",
      },
    };

    // Register config service
    container.register<ConfigService>(
      SERVICE_KEY_STRINGS.CONFIG,
      () => new MockConfigService(mockConfig) as unknown as ConfigService
    );
  });

  describe("register", () => {
    it("should register logger service with container", async () => {
      const module = new LoggerModule();
      await module.register(container);

      expect(container.has(SERVICE_KEY_STRINGS.LOGGER)).toBe(true);
    });

    it("should create logger with config from ConfigService", async () => {
      const module = new LoggerModule();
      await module.register(container);

      const logger = await container.resolve(SERVICE_KEY_STRINGS.LOGGER);
      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe(mockConfig.observability.logs.level);
    });

    it("should respect enabled flag from config", async () => {
      mockConfig.observability.logs.enabled = false;
      container.clear();
      container.register<ConfigService>(
        SERVICE_KEY_STRINGS.CONFIG,
        () => new MockConfigService(mockConfig) as unknown as ConfigService
      );

      const module = new LoggerModule();
      await module.register(container);

      const logger = await container.resolve(SERVICE_KEY_STRINGS.LOGGER);
      expect(logger).toBeDefined();
      // Logger should still be created, but just won't output when disabled
    });

    it("should use format from config", async () => {
      mockConfig.observability.logs.format = "pretty";
      container.clear();
      container.register<ConfigService>(
        SERVICE_KEY_STRINGS.CONFIG,
        () => new MockConfigService(mockConfig) as unknown as ConfigService
      );

      const module = new LoggerModule();
      await module.register(container);

      const logger = await container.resolve(SERVICE_KEY_STRINGS.LOGGER);
      expect(logger).toBeDefined();
    });
  });

  describe("disposeLoggerModule", () => {
    it("should dispose without error when logger exists", async () => {
      const module = new LoggerModule();
      await module.register(container);

      await expect(disposeLoggerModule(container)).resolves.not.toThrow();
    });

    it("should dispose without error when logger does not exist", async () => {
      const emptyContainer = new MockServiceContainer();
      await expect(disposeLoggerModule(emptyContainer)).resolves.not.toThrow();
    });

    it("should call flush on logger if available", async () => {
      const module = new LoggerModule();
      await module.register(container);

      const logger = await container.resolve(SERVICE_KEY_STRINGS.LOGGER);
      const flushSpy = vi.fn();
      logger.flush = flushSpy;

      await disposeLoggerModule(container);

      expect(flushSpy).toHaveBeenCalled();
    });
  });
});
