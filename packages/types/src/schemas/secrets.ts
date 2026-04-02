import { z } from "zod";

// --- Request schemas ---

export const CreateSecretRequestSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.string().min(1).max(10000),
  description: z.string().max(1000).optional(),
});

export const UpdateSecretRequestSchema = z.object({
  value: z.string().min(1).max(10000),
});

export const UpsertEnvVarsRequestSchema = z.object({
  environmentId: z.uuid().nullable().optional(),
  variables: z.record(z.string().min(1), z.string()),
});

// --- Response schemas ---

export const SecretResponseSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  description: z.string().nullable(),
  projectId: z.string().uuid().nullable(),
  lastAccessedAt: z.date().nullable(),
  accessCount: z.int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const EnvironmentVariableResponseSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  environmentId: z.string().uuid().nullable(),
  key: z.string(),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ResolvedEnvVarsResponseSchema = z.record(z.string(), z.string());

// --- Param schemas ---

export const SecretIdParamsSchema = z.object({
  projectId: z.uuid(),
  id: z.uuid(),
});

export const EnvVarDeleteParamsSchema = z.object({
  projectId: z.uuid(),
  key: z.string(),
});

export const EnvVarListQuerySchema = z.object({
  environmentId: z.uuid().optional(),
});

// --- Types ---

export type CreateSecretRequest = z.infer<typeof CreateSecretRequestSchema>;
export type UpdateSecretRequest = z.infer<typeof UpdateSecretRequestSchema>;
export type UpsertEnvVarsRequest = z.infer<typeof UpsertEnvVarsRequestSchema>;
export type SecretResponse = z.infer<typeof SecretResponseSchema>;
export type EnvironmentVariableResponse = z.infer<typeof EnvironmentVariableResponseSchema>;
