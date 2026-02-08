import { z } from "zod";
import {
  IdSchema,
  LogLevelSchema,
  PaginationParamsSchema,
  ServiceTypeSchema,
  SortParamsSchema,
  SourceTypeSchema,
  TimestampSchema,
} from "./common";

export const LogQueryParamsSchema = PaginationParamsSchema.extend({
  since: TimestampSchema.optional(),
  until: TimestampSchema.optional(),
  level: z.union([LogLevelSchema, z.array(LogLevelSchema)]).optional(),
  sourceType: SourceTypeSchema.optional(),
  sourceId: z.string().optional(),
  search: z.string().optional(),
});

const MetricAggregationSchema = z.enum(["avg", "sum", "min", "max", "count"]);

export const MetricQueryParamsSchema = z.object({
  source: z.string().optional(),
  metric: z.string().optional(),
  from: TimestampSchema,
  to: TimestampSchema,
  interval: z.string().optional(),
  aggregation: MetricAggregationSchema.optional(),
});

export const ProjectFiltersSchema = PaginationParamsSchema.merge(SortParamsSchema).extend({
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export const ServiceFiltersSchema = PaginationParamsSchema.merge(SortParamsSchema).extend({
  projectId: IdSchema.optional(),
  type: z.array(ServiceTypeSchema).optional(),
  status: z.array(z.string()).optional(),
});
