import type { ServiceEngineDefinition, EngineVersion } from "./types";
import type { ServiceType } from "@forge/database";
import { ALL_ENGINES } from "./engines";

export class EngineRegistry {
  private readonly engines: Map<string, ServiceEngineDefinition>;

  constructor(engines: ServiceEngineDefinition[] = ALL_ENGINES) {
    this.engines = new Map(engines.map((e) => [e.engine, e]));
  }

  get(engine: string): ServiceEngineDefinition {
    const def = this.engines.get(engine);
    if (!def) {
      throw new EngineNotFoundError(engine);
    }
    return def;
  }

  has(engine: string): boolean {
    return this.engines.has(engine);
  }

  listAll(): ServiceEngineDefinition[] {
    return Array.from(this.engines.values());
  }

  listByType(type: ServiceType): ServiceEngineDefinition[] {
    return this.listAll().filter((e) => e.type === type);
  }

  validateVersion(engine: string, version: string): EngineVersion {
    const def = this.get(engine);
    const v = def.supportedVersions.find((sv) => sv.version === version);
    if (!v) {
      throw new InvalidVersionError(
        engine,
        version,
        def.supportedVersions.map((sv) => sv.version)
      );
    }
    return v;
  }

  getDefaultVersion(engine: string): string {
    return this.get(engine).defaultVersion;
  }
}

export class EngineNotFoundError extends Error {
  constructor(engine: string) {
    super(`Engine "${engine}" is not in the service catalog`);
    this.name = "EngineNotFoundError";
  }
}

export class InvalidVersionError extends Error {
  public readonly engine: string;
  public readonly version: string;
  public readonly available: string[];

  constructor(engine: string, version: string, available: string[]) {
    super(
      `Version "${version}" is not supported for engine "${engine}". Available: ${available.join(", ")}`
    );
    this.name = "InvalidVersionError";
    this.engine = engine;
    this.version = version;
    this.available = available;
  }
}

export const engineRegistry = new EngineRegistry();
