import { z } from "zod";
import {
  DeploymentStrategySchema,
  IdSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  ServiceTypeSchema,
} from "./common";

const PROJECT_NAME_REGEX = /^[a-zA-Z0-9-_]+$/;

export const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).regex(PROJECT_NAME_REGEX),
    type: z.string().max(50).optional(),
    config: MetadataSchema.optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict();

export const UpdateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).regex(PROJECT_NAME_REGEX).optional(),
    type: z.string().max(50).optional(),
    config: MetadataSchema.optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict();

export const DeployProjectRequestSchema = z
  .object({
    version: z.string().optional(),
    strategy: DeploymentStrategySchema.optional(),
    gitUrl: z.string().url().optional(),
    branch: z.string().optional(),
  })
  .strict();

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

export const CreateJobRequestSchema = z
  .object({
    projectId: IdSchema,
    name: NonEmptyStringSchema.max(100),
    command: z.string().min(1),
    schedule: z.string().optional(), // cron expression
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
