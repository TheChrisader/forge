import type { Config } from "./schema";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  static validate(config: Config): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.nodeEnv === "production") {
      if (!config.security.jwt.secret || config.security.jwt.secret.length < 32) {
        errors.push("JWT secret must be at least 32 characters in production");
      }

      if (!config.security.secrets.encryptionKey) {
        errors.push("Secrets encryption key is required in production");
      }

      if (config.server.cors.origins?.includes("*")) {
        warnings.push("CORS is set to allow all origins in production");
      }

      if (
        config.observability.logs.level === "DEBUG" ||
        config.observability.logs.level === "TRACE"
      ) {
        warnings.push("Verbose logging enabled in production may impact performance");
      }
    }

    if (!config.database.url) {
      errors.push("Database URL is required");
    }

    if (!config.redis.host) {
      errors.push("Redis host is required");
    }

    if (!config.docker.socketPath && !config.docker.host) {
      errors.push("Docker socket path or host must be configured");
    }

    if (config.storage.provider === "s3" && !config.storage.s3) {
      errors.push("S3 configuration is required when using S3 storage provider");
    }

    const requiredPaths = ["data", "logs", "builds", "cache"];
    for (const pathKey of requiredPaths) {
      if (!config.paths[pathKey as keyof typeof config.paths]) {
        errors.push(`Path configuration missing: ${pathKey}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateOrThrow(config: Config): void {
    const result = this.validate(config);

    if (!result.valid) {
      throw new Error(`Configuration validation failed:\n${result.errors.join("\n")}`);
    }

    if (result.warnings.length > 0) {
      console.warn("Configuration warnings:");
      result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }
  }
}
