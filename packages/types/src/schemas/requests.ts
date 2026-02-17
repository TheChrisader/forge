import { z } from "zod";
import {
  DeploymentStrategySchema,
  IdSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  ServiceTypeSchema,
} from "./common";

const PROJECT_NAME_REGEX = /^[a-z0-9-]+$/;

// =============================================================================
// Project Request Schemas
// =============================================================================

export const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).regex(PROJECT_NAME_REGEX),
    type: z.string().max(50).optional(),
    sourceType: z.string().max(50).optional(),
    sourceUrl: z.string().optional(),
    config: MetadataSchema.optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict();

export const UpdateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).regex(PROJECT_NAME_REGEX).optional(),
    type: z.string().max(50).optional(),
    sourceType: z.string().max(50).optional(),
    sourceUrl: z.string().optional(),
    config: MetadataSchema.optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict();

// =============================================================================
// Deployment Request Schemas
// =============================================================================

export const DeployProjectRequestSchema = z
  .object({
    version: z.string().optional(),
    strategy: DeploymentStrategySchema.optional(),
    gitUrl: z.string().url().optional(),
    branch: z.string().optional(),
  })
  .strict();

export const CreateDeploymentRequestSchema = z
  .object({
    projectId: IdSchema,
    version: NonEmptyStringSchema,
  })
  .strict();

export const UpdateDeploymentRequestSchema = z
  .object({
    status: z.string().optional(),
    buildStartedAt: z.coerce.date().optional(),
    buildCompletedAt: z.coerce.date().optional(),
    buildImage: z.string().optional(),
    buildLogs: z.string().optional(),
    deployStartedAt: z.coerce.date().optional(),
    deployCompletedAt: z.coerce.date().optional(),
    error: z.string().optional(),
  })
  .strict();

// =============================================================================
// Container Request Schemas
// =============================================================================

export const CreateContainerRequestSchema = z
  .object({
    deploymentId: IdSchema,
    name: z.string().max(255).optional(),
    image: NonEmptyStringSchema,
    config: MetadataSchema.optional(),
    env: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const UpdateContainerRequestSchema = z
  .object({
    name: z.string().max(255).optional(),
    status: z.string().optional(),
    config: MetadataSchema.optional(),
    env: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// =============================================================================
// Service Request Schemas
// =============================================================================

export const CreateServiceRequestSchema = z
  .object({
    projectId: IdSchema,
    name: NonEmptyStringSchema.max(100),
    type: ServiceTypeSchema,
    engine: z.string().optional(),
    version: z.string().optional(),
    config: MetadataSchema.optional(),
  })
  .strict();

export const UpdateServiceRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    config: MetadataSchema.optional(),
  })
  .strict();

// =============================================================================
// Secret Request Schemas
// =============================================================================

export const CreateSecretRequestSchema = z
  .object({
    projectId: IdSchema.optional(),
    key: NonEmptyStringSchema.max(100),
    value: z.string(),
    description: z.string().max(500).optional(),
  })
  .strict();

export const UpdateSecretRequestSchema = z
  .object({
    value: z.string().optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

// =============================================================================
// Job Request Schemas
// =============================================================================

export const CreateJobRequestSchema = z
  .object({
    projectId: IdSchema,
    name: NonEmptyStringSchema.max(100),
    command: z.string().min(1),
    schedule: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export const UpdateJobRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    command: z.string().min(1).optional(),
    schedule: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
