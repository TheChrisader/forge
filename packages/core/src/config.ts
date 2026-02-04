import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/**
 * Configuration schema with validation using Zod.
 * Defines all required and optional environment variables.
 */
const configSchema = z.object({
  // Environment
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),

  // Server
  server: z.object({
    port: z.number().default(4000),
    host: z.string().default("localhost"),
  }),

  // Database
  database: z.object({
    url: z.string(),
  }),

  // Redis
  redis: z.object({
    host: z.string().default("localhost"),
    port: z.number().default(6379),
    password: z.string().optional(),
  }),

  // Logging
  logging: z.object({
    level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  }),
});

/**
 * Load and validate configuration from environment variables.
 *
 * @throws {z.ZodError} If configuration validation fails
 * @returns Validated configuration object
 */
function loadConfig(): z.infer<typeof configSchema> {
  const config = {
    nodeEnv: process.env.NODE_ENV || "development",
    server: {
      port: parseInt(process.env.PORT || "3000", 10),
      host: process.env.HOST || "localhost",
    },
    database: {
      url: process.env.DATABASE_URL || "",
    },
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
    },
    logging: {
      level: (process.env.LOG_LEVEL || "info") as any,
    },
  };

  return configSchema.parse(config);
}

/**
 * Global validated configuration object.
 * Import this to access configuration throughout the application.
 */
export const config = loadConfig();
export type Config = typeof config;
