import type { ConnectionEnvParams } from "./types";
import { engineRegistry } from "./registry";
import { sanitizeEnvPrefix } from "./utils";

export interface ServiceEnvSource {
  id: string;
  name: string;
  engine: string | null;
  status: string;
  connectionHost: string | null;
  connectionPort: number | null;
  connectionUsername: string | null;
  connectionPassword: string;
  connectionDatabase: string | null;
}

/**
 * Resolves service connection env vars for a project.
 *
 * Takes a list of service records (direct + shared) and produces
 * a flat Record<string, string> of env vars to inject at deploy time.
 *
 * Env var format:
 *   {SANITIZED_NAME}_HOST, {SANITIZED_NAME}_PORT, {SANITIZED_NAME}_URL,
 *   {SANITIZED_NAME}_USERNAME, {SANITIZED_NAME}_PASSWORD, etc.
 *
 * Only RUNNING or HEALTHY services with a known engine are included.
 * Passwords must be pre-decrypted by the caller.
 */
export function resolveServiceEnvVars(services: ServiceEnvSource[]): {
  envVars: Record<string, string>;
  warnings: string[];
} {
  const envVars: Record<string, string> = {};
  const warnings: string[] = [];
  const seenPrefixes = new Map<string, string>();

  for (const service of services) {
    if (!service.engine) continue;
    if (service.status !== "RUNNING" && service.status !== "HEALTHY") continue;

    let engineDef;
    try {
      engineDef = engineRegistry.get(service.engine);
    } catch {
      warnings.push(
        `Service "${service.name}" (${service.id}): unknown engine "${service.engine}", skipping`
      );
      continue;
    }

    const prefix = sanitizeEnvPrefix(service.name);

    const existingId = seenPrefixes.get(prefix);
    if (existingId) {
      warnings.push(
        `Service "${service.name}" (${service.id}) collides with service ${existingId} ` +
          `on env prefix "${prefix}". Rename one service to avoid unexpected behavior.`
      );
    }
    seenPrefixes.set(prefix, service.id);

    const params: ConnectionEnvParams = {
      envPrefix: prefix,
      hostname: service.connectionHost ?? "",
      port: service.connectionPort ?? engineDef.defaultPort,
      username: service.connectionUsername ?? "",
      password: service.connectionPassword,
      database: service.connectionDatabase ?? "",
    };

    const serviceEnv = engineDef.connectionEnvVars(params);
    Object.assign(envVars, serviceEnv);
  }

  return { envVars, warnings };
}
