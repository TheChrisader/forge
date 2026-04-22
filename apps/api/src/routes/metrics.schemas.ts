import { z } from "zod";

const SOURCE_TYPE_ENUM = z.enum(["CONTAINER", "SERVICE", "SYSTEM", "BUILD", "DEPLOYMENT"]);

const INTERVAL_ENUM = z.enum(["1m", "5m", "15m", "1h", "6h", "1d"]);

const AGGREGATION_ENUM = z.enum(["avg", "sum", "min", "max", "count", "p50", "p95", "p99"]);

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

export const MetricsQuerySchema = z
  .object({
    sourceType: SOURCE_TYPE_ENUM.optional(),
    sourceId: z.uuid().optional(),
    metric: z.string().max(255).optional(),
    from: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    to: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    interval: INTERVAL_ENUM.optional(),
    aggregation: AGGREGATION_ENUM.optional(),
    projectId: z.uuid().optional(),
  })
  .refine((data) => data.from < data.to, {
    message: "'from' must be before 'to'",
    path: ["from"],
  })
  .refine(
    (data) => {
      const rangeMs = data.to.getTime() - data.from.getTime();
      return rangeMs <= MAX_RANGE_MS;
    },
    {
      message: "Time range cannot exceed 90 days",
      path: ["to"],
    }
  );

export const MetricsSourcesQuerySchema = z.object({
  metric: z.string().max(255).optional(),
  sourceType: SOURCE_TYPE_ENUM.optional(),
  projectId: z.uuid().optional(),
});

export const SourceParamsSchema = z.object({
  sourceType: SOURCE_TYPE_ENUM,
  sourceId: z.uuid(),
});

export const LatestMetricsQuerySchema = z.object({
  sourceType: SOURCE_TYPE_ENUM.optional(),
  sourceId: z.uuid().optional(),
  metric: z.string().max(255).optional(),
  projectId: z.uuid().optional(),
});

export const PlatformSummaryQuerySchema = z.object({
  lookback: z
    .string()
    .regex(/^\d+[mhd]$/)
    .optional()
    .default("1h"),
});

export const SourceMetricsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  to: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  interval: INTERVAL_ENUM.optional(),
});

// --- Response schemas ---

export const MetricPointSchema = z.object({
  timestamp: z.string(),
  value: z.number(),
  sampleCount: z.number().optional(),
});

export const TimeSeriesResultSchema = z.object({
  metric: z.string(),
  sourceType: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  unit: z.string().nullable(),
  labels: z.record(z.string(), z.string()).nullable(),
  points: z.array(MetricPointSchema),
});

export const MetricSourceSchema = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
});

export const LatestMetricValueSchema = z.object({
  metric: z.string(),
  sourceType: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  value: z.number(),
  unit: z.string().nullable(),
  timestamp: z.string(),
});

export const AggregateResultSchema = z.object({
  value: z.number(),
  aggregation: z.string(),
});

export const SourceMetricEntrySchema = z.object({
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.string(),
});

export const SourceSummarySchema = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  projectId: z.string().nullable(),
  metrics: z.array(SourceMetricEntrySchema),
});

export const PlatformSummarySchema = z.object({
  containers: z.object({ total: z.number(), active: z.number() }),
  deployments: z.object({
    total: z.number(),
    active: z.number(),
    successRate: z.number().nullable(),
  }),
  builds: z.object({
    total: z.number(),
    successRate: z.number().nullable(),
    avgDuration: z.number().nullable(),
  }),
  requests: z.object({
    total: z.number(),
    errorRate: z.number().nullable(),
    avgDuration: z.number().nullable(),
  }),
  topSourcesByCpu: z.array(SourceSummarySchema),
  topSourcesByMemory: z.array(SourceSummarySchema),
});

export const MetricsStreamQuerySchema = z
  .object({
    sourceId: z
      .union([z.uuid(), z.array(z.uuid())])
      .optional()
      .transform((v) => {
        if (!v) return undefined as string[] | undefined;
        return Array.isArray(v) ? v : [v];
      }),

    projectId: z.uuid().optional(),

    platform: z.coerce.boolean().optional(),
  })
  .refine((data) => data.sourceId || data.projectId || data.platform, {
    message: "At least one of sourceId, projectId, or platform is required",
  });

export const PrometheusQuerySchema = z.object({
  projectId: z.string().uuid("Valid project ID is required"),
});
