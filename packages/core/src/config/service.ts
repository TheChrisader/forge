import { EventEmitter } from "events";
import type { Config } from "./schema";
import { ConfigLoader } from "./loader";

export class ConfigService extends EventEmitter {
  private config: Config;
  private loader: ConfigLoader;

  constructor() {
    super();
    this.loader = new ConfigLoader();
    this.config = this.loader.load();
  }

  getConfig(): Config {
    return this.config;
  }

  get<T = any>(path: string): T {
    const keys = path.split(".");
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        throw new Error(`Config path not found: ${path}`);
      }
    }

    return value as T;
  }

  has(path: string): boolean {
    try {
      this.get(path);
      return true;
    } catch {
      return false;
    }
  }

  reload(): void {
    const oldConfig = this.config;
    this.config = this.loader.reload();
    this.emit("reload", this.config, oldConfig);
  }

  watch(callback: (newConfig: Config, oldConfig: Config) => void): void {
    this.on("reload", callback);
  }

  validate(): boolean {
    try {
      this.loader.load({ validate: true });
      return true;
    } catch {
      return false;
    }
  }

  isProduction(): boolean {
    return this.config.nodeEnv === "production";
  }

  isDevelopment(): boolean {
    return this.config.nodeEnv === "development";
  }

  isTest(): boolean {
    return this.config.nodeEnv === "test";
  }

  isFeatureEnabled(feature: keyof Config["features"]): boolean {
    return this.config.features[feature];
  }
}

let configService: ConfigService | undefined;

export function getConfigService(): ConfigService {
  if (!configService) {
    configService = new ConfigService();
  }
  return configService;
}
