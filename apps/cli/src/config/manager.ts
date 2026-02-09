import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export interface CliConfig {
  apiUrl: string;
  apiKey?: string;
  defaultProject?: string;
}

export class ConfigManager {
  private configPath: string;
  private config: CliConfig;

  constructor() {
    const configDir = join(homedir(), ".forge");
    this.configPath = join(configDir, "config.json");

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    this.config = this.loadConfig();
  }

  private loadConfig(): CliConfig {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, "utf-8");
        return JSON.parse(content) as CliConfig;
      } catch {
        console.warn("Failed to load config, using defaults");
      }
    }

    return {
      apiUrl: process.env.FORGE_API_URL || "http://localhost:3000",
    };
  }

  private saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch {
      throw new Error("Failed to save config");
    }
  }

  getConfig(): CliConfig {
    return { ...this.config };
  }

  setApiUrl(url: string): void {
    this.config.apiUrl = url;
    this.saveConfig();
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.saveConfig();
  }

  setDefaultProject(projectId: string): void {
    this.config.defaultProject = projectId;
    this.saveConfig();
  }

  getApiUrl(): string {
    return process.env.FORGE_API_URL || this.config.apiUrl;
  }

  getApiKey(): string | undefined {
    return process.env.FORGE_API_KEY || this.config.apiKey;
  }

  getDefaultProject(): string | undefined {
    return this.config.defaultProject;
  }
}
