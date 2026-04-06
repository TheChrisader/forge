import { existsSync, readFileSync } from "fs";
import dotenv from "dotenv";
import { ConfigSchema, type Config } from "./schema";

export interface ConfigLoaderOptions {
  envFile?: string;
  configFile?: string;
  validate?: boolean;
}

export class ConfigLoader {
  private loadedConfig?: Config;

  load(options: ConfigLoaderOptions = {}): Config {
    if (this.loadedConfig) {
      return this.loadedConfig;
    }

    if (options.envFile) {
      this.loadEnvFile(options.envFile);
    } else {
      const defaultEnvFiles = [".env.local", `.env.${process.env.NODE_ENV}`, ".env"];

      for (const file of defaultEnvFiles) {
        if (existsSync(file)) {
          this.loadEnvFile(file);
          break;
        }
      }
    }

    let fileConfig = {};
    if (options.configFile && existsSync(options.configFile)) {
      fileConfig = this.loadConfigFile(options.configFile);
    }

    const config = this.buildConfigFromEnv(fileConfig);

    if (options.validate !== false) {
      this.loadedConfig = this.validateConfig(config);
    } else {
      this.loadedConfig = config;
    }

    return this.loadedConfig;
  }

  reload(options: ConfigLoaderOptions = {}): Config {
    this.loadedConfig = undefined;
    return this.load(options);
  }

  getConfig(): Config {
    if (!this.loadedConfig) {
      throw new Error("Configuration not loaded. Call load() first.");
    }
    return this.loadedConfig;
  }

  private loadEnvFile(filePath: string): void {
    const result = dotenv.config({ path: filePath });
    if (result.error) {
      console.warn(`Failed to load env file ${filePath}:`, result.error);
    }
  }

  private loadConfigFile(filePath: string): Partial<Config> {
    try {
      const content = readFileSync(filePath, "utf-8");

      if (filePath.endsWith(".json")) {
        return JSON.parse(content) as Partial<Config>;
      } else if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
        // TODO: need to implement yaml parser: const yaml = require('yaml');
        // return yaml.parse(content);
        throw new Error("YAML config files not yet supported");
      }

      throw new Error(`Unsupported config file format: ${filePath}`);
    } catch (error) {
      console.error(`Failed to load config file ${filePath}:`, error);
      return {};
    }
  }

  private buildConfigFromEnv(fileConfig: Partial<Config> = {}): Config {
    return {
      nodeEnv: process.env.NODE_ENV || fileConfig.nodeEnv || "development",

      server: {
        port: this.parseNumber(process.env.PORT) ?? fileConfig.server?.port,
        host: process.env.HOST ?? fileConfig.server?.host,
        cors: {
          enabled: this.parseBoolean(process.env.CORS_ENABLED) ?? fileConfig.server?.cors?.enabled,
          origins: this.parseArray(process.env.CORS_ORIGINS) ?? fileConfig.server?.cors?.origins,
          credentials:
            this.parseBoolean(process.env.CORS_CREDENTIALS) ?? fileConfig.server?.cors?.credentials,
        },
        rateLimit: {
          enabled:
            this.parseBoolean(process.env.RATE_LIMIT_ENABLED) ??
            fileConfig.server?.rateLimit?.enabled,
          max: this.parseNumber(process.env.RATE_LIMIT_MAX) ?? fileConfig.server?.rateLimit?.max,
          windowMs:
            this.parseNumber(process.env.RATE_LIMIT_WINDOW_MS) ??
            fileConfig.server?.rateLimit?.windowMs,
        },
      },

      database: {
        url: process.env.DATABASE_URL ?? fileConfig.database?.url,
        pool: {
          min: this.parseNumber(process.env.DB_POOL_MIN) ?? fileConfig.database?.pool?.min,
          max: this.parseNumber(process.env.DB_POOL_MAX) ?? fileConfig.database?.pool?.max,
          idleTimeoutMillis:
            this.parseNumber(process.env.DB_POOL_IDLE_TIMEOUT) ??
            fileConfig.database?.pool?.idleTimeoutMillis,
        },
        ssl: this.parseBoolean(process.env.DB_SSL) ?? fileConfig.database?.ssl,
        logging: this.parseBoolean(process.env.DB_LOGGING) ?? fileConfig.database?.logging,
      },

      redis: {
        host: process.env.REDIS_HOST ?? fileConfig.redis?.host,
        port: this.parseNumber(process.env.REDIS_PORT) ?? fileConfig.redis?.port,
        password: process.env.REDIS_PASSWORD ?? fileConfig.redis?.password,
        db: this.parseNumber(process.env.REDIS_DB) ?? fileConfig.redis?.db,
        keyPrefix: process.env.REDIS_KEY_PREFIX ?? fileConfig.redis?.keyPrefix,
      },

      cache: {
        provider: process.env.CACHE_PROVIDER ?? fileConfig.cache?.provider,
        ttl: this.parseNumber(process.env.CACHE_TTL) ?? fileConfig.cache?.ttl,
        maxEntries: this.parseNumber(process.env.CACHE_MAX_ENTRIES) ?? fileConfig.cache?.maxEntries,
      },

      queue: {
        connection: {
          host: process.env.QUEUE_HOST ?? fileConfig.queue?.connection?.host,
          port: this.parseNumber(process.env.QUEUE_PORT) ?? fileConfig.queue?.connection?.port,
          password: process.env.QUEUE_PASSWORD ?? fileConfig.queue?.connection?.password,
          db: this.parseNumber(process.env.QUEUE_DB) ?? fileConfig.queue?.connection?.db,
        },
        defaultJobOptions: {
          attempts:
            this.parseNumber(process.env.QUEUE_JOB_ATTEMPTS) ??
            fileConfig.queue?.defaultJobOptions?.attempts,
          backoff: {
            type: (process.env.QUEUE_BACKOFF_TYPE ??
              fileConfig.queue?.defaultJobOptions?.backoff?.type) as
              | "exponential"
              | "fixed"
              | undefined,
            delay:
              this.parseNumber(process.env.QUEUE_BACKOFF_DELAY) ??
              fileConfig.queue?.defaultJobOptions?.backoff?.delay,
          },
          removeOnComplete:
            this.parseNumber(process.env.QUEUE_REMOVE_ON_COMPLETE) ??
            fileConfig.queue?.defaultJobOptions?.removeOnComplete,
          removeOnFail:
            this.parseNumber(process.env.QUEUE_REMOVE_ON_FAIL) ??
            fileConfig.queue?.defaultJobOptions?.removeOnFail,
        },
      },

      docker: {
        socketPath: process.env.DOCKER_SOCKET ?? fileConfig.docker?.socketPath,
        host: process.env.DOCKER_HOST ?? fileConfig.docker?.host,
        port: this.parseNumber(process.env.DOCKER_PORT) ?? fileConfig.docker?.port,
        network: {
          default: process.env.DOCKER_NETWORK ?? fileConfig.docker?.network?.default,
          driver: process.env.DOCKER_NETWORK_DRIVER ?? fileConfig.docker?.network?.driver,
        },
        registry: fileConfig.docker?.registry,
      },

      storage: {
        provider: process.env.STORAGE_PROVIDER ?? fileConfig.storage?.provider,
        local: {
          basePath: process.env.STORAGE_LOCAL_PATH ?? fileConfig.storage?.local?.basePath,
        },
        s3: fileConfig.storage?.s3
          ? {
              bucket: process.env.S3_BUCKET ?? fileConfig.storage.s3.bucket,
              region: process.env.S3_REGION ?? fileConfig.storage.s3.region,
              accessKeyId: process.env.S3_ACCESS_KEY_ID ?? fileConfig.storage.s3.accessKeyId,
              secretAccessKey:
                process.env.S3_SECRET_ACCESS_KEY ?? fileConfig.storage.s3.secretAccessKey,
              endpoint: process.env.S3_ENDPOINT ?? fileConfig.storage.s3.endpoint,
            }
          : undefined,
      },

      proxy: {
        provider: process.env.PROXY_PROVIDER ?? fileConfig.proxy?.provider,
        httpPort: this.parseNumber(process.env.PROXY_HTTP_PORT) ?? fileConfig.proxy?.httpPort,
        httpsPort: this.parseNumber(process.env.PROXY_HTTPS_PORT) ?? fileConfig.proxy?.httpsPort,
        domain: process.env.PROXY_DOMAIN ?? fileConfig.proxy?.domain,
        ssl: {
          enabled:
            this.parseBoolean(process.env.PROXY_SSL_ENABLED) ?? fileConfig.proxy?.ssl?.enabled,
          autoGenerate:
            this.parseBoolean(process.env.PROXY_SSL_AUTO) ?? fileConfig.proxy?.ssl?.autoGenerate,
        },
      },

      observability: {
        logs: {
          enabled:
            this.parseBoolean(process.env.LOGS_ENABLED) ?? fileConfig.observability?.logs?.enabled,
          level: process.env.LOG_LEVEL ?? fileConfig.observability?.logs?.level,
          retention: process.env.LOG_RETENTION ?? fileConfig.observability?.logs?.retention,
          format: process.env.LOG_FORMAT ?? fileConfig.observability?.logs?.format,
        },
        metrics: {
          enabled:
            this.parseBoolean(process.env.METRICS_ENABLED) ??
            fileConfig.observability?.metrics?.enabled,
          interval:
            this.parseNumber(process.env.METRICS_INTERVAL) ??
            fileConfig.observability?.metrics?.interval,
          retention: process.env.METRICS_RETENTION ?? fileConfig.observability?.metrics?.retention,
        },
        tracing: {
          enabled:
            this.parseBoolean(process.env.TRACING_ENABLED) ??
            fileConfig.observability?.tracing?.enabled,
          samplingRate:
            this.parseNumber(process.env.TRACING_SAMPLING_RATE) ??
            fileConfig.observability?.tracing?.samplingRate,
          endpoint: process.env.TRACING_ENDPOINT ?? fileConfig.observability?.tracing?.endpoint,
        },
      },

      security: {
        admin:
          process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH
            ? {
                email: process.env.ADMIN_EMAIL,
                passwordHash: process.env.ADMIN_PASSWORD_HASH,
              }
            : fileConfig.security?.admin,
        secrets: {
          encryptionKey:
            process.env.SECRETS_ENCRYPTION_KEY ?? fileConfig.security?.secrets?.encryptionKey,
          rotationDays:
            this.parseNumber(process.env.SECRETS_ROTATION_DAYS) ??
            fileConfig.security?.secrets?.rotationDays,
        },
        jwt: {
          secret: process.env.JWT_SECRET ?? fileConfig.security?.jwt?.secret,
          expiresIn: process.env.JWT_EXPIRES_IN ?? fileConfig.security?.jwt?.expiresIn,
          issuer: process.env.JWT_ISSUER ?? fileConfig.security?.jwt?.issuer,
        },
        apiKey: {
          header: process.env.API_KEY_HEADER ?? fileConfig.security?.apiKey?.header,
          required:
            this.parseBoolean(process.env.API_KEY_REQUIRED) ??
            fileConfig.security?.apiKey?.required,
        },
        rateLimit: {
          enabled:
            this.parseBoolean(process.env.SECURITY_RATE_LIMIT_ENABLED) ??
            fileConfig.security?.rateLimit?.enabled,
          max:
            this.parseNumber(process.env.SECURITY_RATE_LIMIT_MAX) ??
            fileConfig.security?.rateLimit?.max,
          windowMs:
            this.parseNumber(process.env.SECURITY_RATE_LIMIT_WINDOW) ??
            fileConfig.security?.rateLimit?.windowMs,
        },
        registration: {
          enabled:
            this.parseBoolean(process.env.REGISTRATION_ENABLED) ??
            fileConfig.security?.registration?.enabled,
        },
      },

      features: {
        autoSSL: this.parseBoolean(process.env.FEATURE_AUTO_SSL) ?? fileConfig.features?.autoSSL,
        imageScan:
          this.parseBoolean(process.env.FEATURE_IMAGE_SCAN) ?? fileConfig.features?.imageScan,
        multiUser:
          this.parseBoolean(process.env.FEATURE_MULTI_USER) ?? fileConfig.features?.multiUser,
        plugins: this.parseBoolean(process.env.FEATURE_PLUGINS) ?? fileConfig.features?.plugins,
        webSearch:
          this.parseBoolean(process.env.FEATURE_WEB_SEARCH) ?? fileConfig.features?.webSearch,
        hotReload:
          this.parseBoolean(process.env.FEATURE_HOT_RELOAD) ?? fileConfig.features?.hotReload,
      },

      paths: {
        data: process.env.PATH_DATA ?? fileConfig.paths?.data,
        logs: process.env.PATH_LOGS ?? fileConfig.paths?.logs,
        builds: process.env.PATH_BUILDS ?? fileConfig.paths?.builds,
        cache: process.env.PATH_CACHE ?? fileConfig.paths?.cache,
        plugins: process.env.PATH_PLUGINS ?? fileConfig.paths?.plugins,
        temp: process.env.PATH_TEMP ?? fileConfig.paths?.temp,
      },

      sse: {
        enabled: this.parseBoolean(process.env.SSE_ENABLED) ?? fileConfig.sse?.enabled,
        maxConnectionsPerTopic:
          this.parseNumber(process.env.SSE_MAX_CONNECTIONS_PER_TOPIC) ??
          fileConfig.sse?.maxConnectionsPerTopic,
        maxTotalConnections:
          this.parseNumber(process.env.SSE_MAX_TOTAL_CONNECTIONS) ??
          fileConfig.sse?.maxTotalConnections,
        connectionTimeoutMs:
          this.parseNumber(process.env.SSE_CONNECTION_TIMEOUT_MS) ??
          fileConfig.sse?.connectionTimeoutMs,
        heartbeatIntervalMs:
          this.parseNumber(process.env.SSE_HEARTBEAT_INTERVAL_MS) ??
          fileConfig.sse?.heartbeatIntervalMs,
        batchThreshold:
          this.parseNumber(process.env.SSE_BATCH_THRESHOLD) ?? fileConfig.sse?.batchThreshold,
        batchWindowMs:
          this.parseNumber(process.env.SSE_BATCH_WINDOW_MS) ?? fileConfig.sse?.batchWindowMs,
        batchMaxSize:
          this.parseNumber(process.env.SSE_BATCH_MAX_SIZE) ?? fileConfig.sse?.batchMaxSize,
      },

      terminal: {
        maxSessionsPerUser:
          this.parseNumber(process.env.TERMINAL_MAX_SESSIONS_PER_USER) ??
          fileConfig.terminal?.maxSessionsPerUser,
        idleTimeoutMs:
          this.parseNumber(process.env.TERMINAL_IDLE_TIMEOUT_MS) ??
          fileConfig.terminal?.idleTimeoutMs,
        cleanupIntervalMs:
          this.parseNumber(process.env.TERMINAL_CLEANUP_INTERVAL_MS) ??
          fileConfig.terminal?.cleanupIntervalMs,
        defaultShell: process.env.TERMINAL_DEFAULT_SHELL ?? fileConfig.terminal?.defaultShell,
        defaultRows:
          this.parseNumber(process.env.TERMINAL_DEFAULT_ROWS) ?? fileConfig.terminal?.defaultRows,
        defaultCols:
          this.parseNumber(process.env.TERMINAL_DEFAULT_COLS) ?? fileConfig.terminal?.defaultCols,
      },
    } as Config;
  }

  private validateConfig(config: Partial<Config>): Config {
    try {
      return ConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Configuration validation failed:", error.message);
      }
      throw new Error(
        "Invalid configuration. Please check your environment variables and config files."
      );
    }
  }

  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private parseBoolean(value: string | undefined): boolean | undefined {
    if (!value) return undefined;
    return value === "true" || value === "1";
  }

  private parseArray(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    return value.split(",").map((s) => s.trim());
  }
}

const configLoader = new ConfigLoader();

export function loadConfig(options?: ConfigLoaderOptions): Config {
  return configLoader.load(options);
}

export function reloadConfig(options?: ConfigLoaderOptions): Config {
  return configLoader.reload(options);
}

export function getConfig(): Config {
  return configLoader.getConfig();
}
