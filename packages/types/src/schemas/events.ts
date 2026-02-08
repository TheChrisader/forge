import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common";

export const EventTypeSchema = z.enum([
  "deployment.started",
  "deployment.progress",
  "deployment.completed",
  "deployment.failed",
  "container.created",
  "container.started",
  "container.stopped",
  "container.removed",
  "log.entry",
  "metric.data",
  "health.check",
]);

export const BaseEventSchema = z.object({
  type: EventTypeSchema,
  timestamp: TimestampSchema,
  data: z.unknown(),
});

export const DeploymentEventDataSchema = z.object({
  deploymentId: IdSchema,
  projectId: IdSchema,
  status: z.string(),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const DeploymentEventSchema = z.object({
  type: z.enum([
    "deployment.started",
    "deployment.progress",
    "deployment.completed",
    "deployment.failed",
  ]),
  timestamp: TimestampSchema,
  data: DeploymentEventDataSchema,
});

export const LogEventSchema = z.object({
  type: z.literal("log.entry"),
  timestamp: TimestampSchema,
  data: z.object({
    sourceId: z.string(),
    sourceType: z.string(),
    level: z.string(),
    message: z.string(),
    timestamp: TimestampSchema,
  }),
});

export const MetricEventSchema = z.object({
  type: z.literal("metric.data"),
  timestamp: TimestampSchema,
  data: z.object({
    sourceId: z.string(),
    sourceType: z.string(),
    metric: z.string(),
    value: z.number(),
    unit: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
  }),
});

export const HealthCheckEventSchema = z.object({
  type: z.literal("health.check"),
  timestamp: TimestampSchema,
  data: z.object({
    deploymentId: IdSchema,
    status: z.enum(["healthy", "unhealthy", "starting"]),
    message: z.string().optional(),
  }),
});

export const ContainerEventSchema = z.object({
  type: z.enum([
    "container.created",
    "container.started",
    "container.stopped",
    "container.removed",
  ]),
  timestamp: TimestampSchema,
  data: z.object({
    containerId: z.string(),
    deploymentId: IdSchema,
    status: z.string(),
  }),
});

export const ForgeEventSchema = z.discriminatedUnion("type", [
  DeploymentEventSchema,
  LogEventSchema,
  MetricEventSchema,
  HealthCheckEventSchema,
  ContainerEventSchema,
  BaseEventSchema,
]);
