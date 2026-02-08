import { z } from "zod";
import {
  DeploymentStatusSchema,
  DeploymentStrategySchema,
  HealthStatusSchema,
  IdSchema,
  JobEntityStatusSchema,
  LogLevelSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  ServiceStatusSchema,
  ServiceTypeSchema,
  SourceTypeSchema,
  TimestampSchema,
} from "./common";

export const ServiceConnectionSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  url: z.string().optional(),
  username: z.string().optional(),
  database: z.string().optional(),
});

export const ServiceSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(100),
  type: ServiceTypeSchema,
  engine: z.string().optional(),
  version: z.string().optional(),
  status: ServiceStatusSchema,
  config: MetadataSchema,
  connection: ServiceConnectionSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// value never gets returned
export const SecretSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.optional(),
  key: NonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().optional(),
});

export const LogEntrySchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  level: LogLevelSchema,
  sourceType: SourceTypeSchema,
  sourceId: z.string(),
  sourceName: z.string(),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

export const MetricSchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  sourceType: SourceTypeSchema,
  sourceId: z.string(),
  sourceName: z.string(),
  metric: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

export const JobSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(100),
  command: z.string(),
  schedule: z.string().optional(),
  status: JobEntityStatusSchema,
  lastRun: TimestampSchema.optional(),
  nextRun: TimestampSchema.optional(),
  enabled: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const DeploymentSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  version: z.string(),
  status: DeploymentStatusSchema,
  strategy: DeploymentStrategySchema,
  health: HealthStatusSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const ContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["running", "exited", "paused", "restarting", "dead"]),
  image: z.string(),
  ports: z
    .array(z.object({ private: z.number(), public: z.number().optional(), type: z.string() }))
    .optional(),
});
