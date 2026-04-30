import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigLoader } from "./loader";
import { ConfigValidator } from "./validator";
import { ConfigService } from "./service";

describe("ConfigLoader", () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
    process.env.NODE_ENV = "test";
    process.env.PORT = "3000";
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.REDIS_HOST = "localhost";
    process.env.JWT_SECRET = "test-secret-must-be-at-least-32-characters-long";
  });

  it("should load default configuration", () => {
    const config = loader.load({ validate: false });

    expect(config).toBeDefined();
    expect(config.nodeEnv).toBe("test");
    expect(config.server.port).toBe(3000);
  });

  it("should validate configuration", () => {
    const config = loader.load({ validate: true });

    expect(config).toBeDefined();
    expect(config.nodeEnv).toBeDefined();
  });

  it("should reload configuration", () => {
    loader.load();
    const config2 = loader.reload();

    expect(config2).toBeDefined();
  });

  it("should throw if config not loaded before getConfig", () => {
    const newLoader = new ConfigLoader();
    expect(() => newLoader.getConfig()).toThrow("Configuration not loaded");
  });

  it("should get current configuration", () => {
    loader.load();
    const config = loader.getConfig();

    expect(config).toBeDefined();
    expect(config.nodeEnv).toBe("test");
  });
});

describe("ConfigValidator", () => {
  it("should validate valid configuration", () => {
    const config: any = {
      nodeEnv: "development",
      server: {
        port: 3000,
        host: "localhost",
        cors: { enabled: true, origins: ["*"], credentials: true },
        rateLimit: { enabled: true, max: 100, windowMs: 60000 },
      },
      database: {
        url: "postgresql://localhost:5432/test",
        pool: { min: 2, max: 10, idleTimeoutMillis: 30000 },
        ssl: false,
        logging: false,
      },
      redis: { host: "localhost", port: 6379, db: 0 },
      cache: { provider: "redis", ttl: 3600 },
      queue: {
        connection: { host: "localhost", port: 6379, db: 1 },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      },
      docker: {
        socketPath: "/var/run/docker.sock",
        network: { default: "forge", driver: "bridge" },
      },
      storage: { provider: "local", local: { basePath: "./data" } },
      proxy: {
        provider: "traefik",
        httpPort: 80,
        httpsPort: 443,
        domain: "localhost",
        ssl: { enabled: true, autoGenerate: true },
      },
      observability: {
        logs: { enabled: true, level: "info", retention: "30d", format: "json" },
        metrics: { enabled: true, interval: 10000, retention: "90d" },
        tracing: { enabled: false, samplingRate: 0.1 },
      },
      security: {
        secrets: { rotationDays: 90 },
        jwt: {
          secret: "test-secret-must-be-at-least-32-characters-long",
          expiresIn: "7d",
          issuer: "forge",
        },
        rateLimit: { enabled: true, max: 1000, windowMs: 60000 },
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

    const result = ConfigValidator.validate(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing required fields", () => {
    const config: any = {
      nodeEnv: "production",
      server: { port: 3000, host: "localhost", cors: {}, rateLimit: {} },
      database: { url: "", pool: {}, ssl: false, logging: false },
      redis: { host: "", port: 6379, db: 0 },
      cache: { provider: "redis", ttl: 3600 },
      queue: {
        connection: { host: "localhost", port: 6379, db: 1 },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      },
      docker: {},
      storage: { provider: "local" },
      proxy: { provider: "traefik", httpPort: 80, httpsPort: 443, domain: "localhost", ssl: {} },
      observability: { logs: {}, metrics: {}, tracing: {} },
      security: {
        secrets: {},
        jwt: { secret: "short", expiresIn: "7d", issuer: "forge" },
        rateLimit: {},
      },
      features: {},
      paths: {},
    };

    const result = ConfigValidator.validate(config);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should warn about insecure production settings", () => {
    const config: any = {
      nodeEnv: "production",
      server: {
        port: 3000,
        host: "localhost",
        cors: { enabled: true, origins: ["*"], credentials: true },
        rateLimit: { enabled: true, max: 100, windowMs: 60000 },
      },
      database: {
        url: "postgresql://localhost:5432/test",
        pool: { min: 2, max: 10, idleTimeoutMillis: 30000 },
        ssl: false,
        logging: false,
      },
      redis: { host: "localhost", port: 6379, db: 0 },
      cache: { provider: "redis", ttl: 3600 },
      queue: {
        connection: { host: "localhost", port: 6379, db: 1 },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      },
      docker: {
        socketPath: "/var/run/docker.sock",
        network: { default: "forge", driver: "bridge" },
      },
      storage: { provider: "local", local: { basePath: "./data" } },
      proxy: {
        provider: "traefik",
        httpPort: 80,
        httpsPort: 443,
        domain: "localhost",
        ssl: { enabled: true, autoGenerate: true },
      },
      observability: {
        logs: { enabled: true, level: "DEBUG", retention: "30d", format: "json" },
        metrics: { enabled: true, interval: 10000, retention: "90d" },
        tracing: { enabled: false, samplingRate: 0.1 },
      },
      security: {
        secrets: { rotationDays: 90 },
        jwt: {
          secret: "test-secret-must-be-at-least-32-characters-long",
          expiresIn: "7d",
          issuer: "forge",
        },
        rateLimit: { enabled: true, max: 1000, windowMs: 60000 },
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

    const result = ConfigValidator.validate(config);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("CORS"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("logging"))).toBe(true);
  });

  it("should throw when validateOrThrow fails", () => {
    const config: any = {
      nodeEnv: "production",
      server: { port: 3000, host: "localhost", cors: {}, rateLimit: {} },
      database: { url: "", pool: {}, ssl: false, logging: false },
      redis: { host: "", port: 6379, db: 0 },
      cache: { provider: "redis", ttl: 3600 },
      queue: {
        connection: { host: "localhost", port: 6379, db: 1 },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      },
      docker: {},
      storage: { provider: "local" },
      proxy: { provider: "traefik", httpPort: 80, httpsPort: 443, domain: "localhost", ssl: {} },
      observability: { logs: {}, metrics: {}, tracing: {} },
      security: {
        secrets: {},
        jwt: { secret: "short", expiresIn: "7d", issuer: "forge" },
        rateLimit: {},
      },
      features: {},
      paths: {},
    };

    expect(() => ConfigValidator.validateOrThrow(config)).toThrow();
  });
});

describe("ConfigService", () => {
  let service: ConfigService;

  beforeEach(() => {
    service = new ConfigService();
    process.env.NODE_ENV = "test";
    process.env.PORT = "3000";
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.REDIS_HOST = "localhost";
    process.env.JWT_SECRET = "test-secret-must-be-at-least-32-characters-long";
  });

  it("should get entire config", () => {
    const config = service.getConfig();

    expect(config).toBeDefined();
    expect(config.nodeEnv).toBeDefined();
  });

  it("should get config value by path", () => {
    const port = service.get<number>("server.port");

    expect(port).toBeDefined();
    expect(typeof port).toBe("number");
  });

  it("should throw for invalid path", () => {
    expect(() => service.get("nonexistent.path")).toThrow("Config path not found");
  });

  it("should check if path exists", () => {
    expect(service.has("server.port")).toBe(true);
    expect(service.has("nonexistent.path")).toBe(false);
  });

  it("should detect environment", () => {
    expect(service.isDevelopment() || service.isProduction() || service.isTest()).toBe(true);
  });

  it("should check feature flags", () => {
    const autoSSL = service.isFeatureEnabled("autoSSL");

    expect(typeof autoSSL).toBe("boolean");
  });

  it("should emit reload event", () => {
    const callback = vi.fn();
    service.watch(callback);

    service.reload();

    expect(callback).toHaveBeenCalled();
  });

  it("should validate configuration", () => {
    const isValid = service.validate();

    expect(typeof isValid).toBe("boolean");
  });
});
