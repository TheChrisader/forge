import { z } from "zod";

export const EnvironmentSchema = z.enum(["development", "production", "test", "staging"]);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const LogLevelSchema = z.enum(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const ServerConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  host: z.string().default("localhost"),
  proxy: z.boolean().default(false),
  cors: z.object({
    enabled: z.boolean().default(true),
    origins: z.array(z.string()).default(["*"]),
    credentials: z.boolean().default(true),
  }),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    max: z.number().int().positive().default(100),
    windowMs: z.number().int().positive().default(60000),
  }),
});

export const DatabaseConfigSchema = z.object({
  url: z.url().or(z.string().startsWith("postgresql://")),
  pool: z.object({
    min: z.number().int().nonnegative().default(2),
    max: z.number().int().positive().default(10),
    idleTimeoutMillis: z.number().int().positive().default(30000),
  }),
  ssl: z.boolean().default(false),
  logging: z.boolean().default(false),
});

export const RedisConfigSchema = z.object({
  host: z.string().default("localhost"),
  port: z.number().int().positive().default(6379),
  password: z.string().optional(),
  db: z.number().int().nonnegative().default(0),
  keyPrefix: z.string().optional(),
  maxRetriesPerRequest: z.number().int().nullable().default(null),
  enableReadyCheck: z.boolean().default(false),
});

export const CacheConfigSchema = z.object({
  provider: z.enum(["redis", "memory"]).default("redis"),
  ttl: z.number().int().positive().default(3600),
  maxEntries: z.number().int().positive().optional(),
});

export const QueueConfigSchema = z.object({
  connection: z.object({
    host: z.string().default("localhost"),
    port: z.number().int().positive().default(6379),
    password: z.string().optional(),
    db: z.number().int().nonnegative().default(1),
  }),
  defaultJobOptions: z.object({
    attempts: z.number().int().positive().default(3),
    backoff: z.object({
      type: z.enum(["exponential", "fixed"]).default("exponential"),
      delay: z.number().int().positive().default(5000),
    }),
    removeOnComplete: z.number().int().nonnegative().default(10),
    removeOnFail: z.number().int().nonnegative().default(50),
  }),
});

export const DockerConfigSchema = z.object({
  socketPath: z.string().default("/var/run/docker.sock"),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  network: z.object({
    default: z.string().default("forge-network"),
    driver: z.enum(["bridge", "host", "overlay"]).default("bridge"),
  }),
  registry: z
    .object({
      url: z.url().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    })
    .optional(),
});

export const StorageConfigSchema = z.object({
  provider: z.enum(["local", "s3", "minio", "gcs", "azure"]).default("local"),
  local: z
    .object({
      basePath: z.string().default("./data"),
    })
    .optional(),
  s3: z
    .object({
      bucket: z.string(),
      region: z.string(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      endpoint: z.url().optional(),
    })
    .optional(),
});

export const ProxyConfigSchema = z.object({
  provider: z.enum(["traefik", "caddy", "nginx", "custom"]).default("traefik"),
  httpPort: z.number().int().positive().default(80),
  httpsPort: z.number().int().positive().default(443),
  domain: z.string().default("local.dev"),
  ssl: z.object({
    enabled: z.boolean().default(true),
    autoGenerate: z.boolean().default(true),
  }),
});

export const ObservabilityConfigSchema = z.object({
  logs: z.object({
    enabled: z.boolean().default(true),
    level: LogLevelSchema.default("INFO"),
    retention: z.string().default("30d"),
    format: z.enum(["json", "pretty"]).default("json"),
  }),
  metrics: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().int().positive().default(10000),
    retention: z.string().default("90d"),
  }),
  tracing: z.object({
    enabled: z.boolean().default(false),
    samplingRate: z.number().min(0).max(1).default(0.1),
    endpoint: z.url().optional(),
  }),
});

export const SecurityConfigSchema = z.object({
  admin: z
    .object({
      email: z.email(),
      passwordHash: z.string().length(64),
    })
    .optional(),
  secrets: z.object({
    encryptionKey: z.string().min(32).optional(),
    rotationDays: z.number().int().positive().default(90),
  }),
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default("15m"),
    refreshExpiresIn: z.string().default("7d"),
    issuer: z.string().default("forge"),
  }),
  apiKey: z
    .object({
      header: z.string().default("x-api-key"),
      required: z.boolean().default(false),
    })
    .optional(),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    max: z.number().int().positive().default(1000),
    windowMs: z.number().int().positive().default(60000),
  }),
  registration: z.object({
    enabled: z.boolean().default(false),
  }),
});

export const FeaturesConfigSchema = z.object({
  autoSSL: z.boolean().default(true),
  imageScan: z.boolean().default(true),
  multiUser: z.boolean().default(false),
  plugins: z.boolean().default(true),
  webSearch: z.boolean().default(false),
  hotReload: z.boolean().default(true),
});

export const PathsConfigSchema = z.object({
  data: z.string().default("./data"),
  logs: z.string().default("./logs"),
  builds: z.string().default("./builds"),
  cache: z.string().default("./cache"),
  plugins: z.string().default("./plugins"),
  temp: z.string().default("./tmp"),
});

export const SSEConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxConnectionsPerTopic: z.number().int().positive().default(100),
  maxTotalConnections: z.number().int().positive().default(1000),
  connectionTimeoutMs: z.number().int().positive().default(300000),
  heartbeatIntervalMs: z.number().int().positive().default(30000),
  batchThreshold: z.number().int().positive().default(50),
  batchWindowMs: z.number().int().positive().default(50),
  batchMaxSize: z.number().int().positive().default(100),
});

export type SSEConfig = z.infer<typeof SSEConfigSchema>;

export const TerminalConfigSchema = z.object({
  maxSessionsPerUser: z.number().int().positive().default(5),
  idleTimeoutMs: z
    .int()
    .positive()
    .default(15 * 60 * 1000),
  cleanupIntervalMs: z
    .int()
    .positive()
    .default(30 * 1000),
  defaultShell: z.string().default("/bin/bash"),
  defaultRows: z.number().int().positive().default(24),
  defaultCols: z.number().int().positive().default(80),
});

export type TerminalConfig = z.infer<typeof TerminalConfigSchema>;

export const ConfigSchema = z.object({
  nodeEnv: EnvironmentSchema.default("development"),
  server: ServerConfigSchema,
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema,
  cache: CacheConfigSchema,
  queue: QueueConfigSchema,
  docker: DockerConfigSchema,
  storage: StorageConfigSchema,
  proxy: ProxyConfigSchema,
  observability: ObservabilityConfigSchema,
  security: SecurityConfigSchema,
  features: FeaturesConfigSchema,
  paths: PathsConfigSchema,
  sse: SSEConfigSchema.optional(),
  terminal: TerminalConfigSchema.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
