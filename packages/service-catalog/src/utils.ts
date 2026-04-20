import type { ServiceEngineDefinition, EngineVersion } from "./types";

export function resolveImageRef(
  engineDef: ServiceEngineDefinition,
  engineVersion: EngineVersion
): string {
  return `${engineDef.image}:${engineVersion.imageTag}`;
}

export function sanitizeEnvPrefix(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export const HEALTH_CHECK_TIMING = {
  interval: 10_000_000_000,
  timeout: 5_000_000_000,
  retries: 3,
  startPeriod: 30_000_000_000,
} as const;

export const HEALTH_CHECK_TIMING_SLOW = {
  interval: 15_000_000_000,
  timeout: 10_000_000_000,
  retries: 5,
  startPeriod: 120_000_000_000,
} as const;
