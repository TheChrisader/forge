import type { ServiceType } from "@forge/database";

// --- Engine definition (the heart of the catalog) ---

export interface EngineResourceDefaults {
  memoryMB: number;
  memoryReservationMB: number;
  cpuShares: number;
}

export interface ServiceEngineDefinition {
  type: ServiceType;
  engine: string;
  displayName: string;
  description: string;
  icon: string;
  image: string;
  supportedVersions: EngineVersion[];
  defaultVersion: string;
  defaultPort: number;
  dataPath: string;
  defaultEnv: (params: CreateServiceParams) => Record<string, string>;
  healthCheck: (params: CreateServiceParams) => HealthCheckConfig;
  connectionUrl: (params: ConnectionUrlParams) => string;
  connectionEnvVars: (params: ConnectionEnvParams) => Record<string, string>;
  configParameters: ConfigParameter[];
  resourceDefaults: EngineResourceDefaults;
}

export interface EngineVersion {
  version: string;
  imageTag: string;
  minMemoryMB?: number;
  deprecated?: boolean;
}

export interface ConfigParameter {
  key: string;
  label: string;
  type: "integer" | "string" | "boolean";
  defaultValue: string;
  envMapping: string;
  description: string;
}

// --- Health check config (maps to Docker's HealthCheck) ---

export interface HealthCheckConfig {
  test: string[];
  interval: number;
  timeout: number;
  retries: number;
  startPeriod: number;
}

// --- Parameter types passed to engine methods ---

export interface CreateServiceParams {
  name: string;
  version: string;
  username: string;
  password: string;
  database: string;
  configOverrides: Record<string, string>;
}

export interface ConnectionUrlParams {
  hostname: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface ConnectionEnvParams {
  envPrefix: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

// --- Credential generation result ---

export interface GeneratedCredentials {
  username: string;
  password: string;
  database: string;
}

// --- Service job data types (for the queue) ---

export type ServiceJobType =
  | "PROVISION"
  | "DEPROVISION"
  | "START"
  | "STOP"
  | "RESTART"
  | "BACKUP"
  | "RESTORE"
  | "UPGRADE";

export interface ServiceJobData {
  jobType: ServiceJobType;
  serviceId: string;
  projectId: string;
  backupId?: string;
  previousStatus?: string;
  targetVersion?: string;
}
