import { z } from "zod";
import {
  AlertSeveritySchema,
  AlertStatusSchema,
  ChannelTypeSchema,
  DeploymentStatusSchema,
  DeploymentStrategySchema,
  IdSchema,
  LogLevelSchema,
  PaginationParamsSchema,
  ProjectStatusSchema,
  ServiceTypeSchema,
  SortOrderSchema,
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

export const ProjectFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  sourceType: z.array(z.string()).optional(),
  search: z.string().optional(),
});

/* eslint-disable @typescript-eslint/explicit-function-return-type */
const commaSeparatedOrArrayEnum = <T extends Readonly<Record<string, z.core.util.EnumValue>>>(
  enumValues: T
) => {
  const enumSchema = z.enum(enumValues);

  return z
    .union([enumSchema, z.string().transform((val) => val.split(",")), z.array(enumSchema)])
    .transform((val) => {
      if (Array.isArray(val)) return val;
      return [val];
    })
    .pipe(z.array(enumSchema));
};
/* eslint-enable @typescript-eslint/explicit-function-return-type */

export const ProjectListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: commaSeparatedOrArrayEnum(ProjectStatusSchema.enum).optional(),
});

export const ProjectIdParamsSchema = z.object({
  projectId: IdSchema,
});

export const DeploymentFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
  projectId: IdSchema.optional(),
  status: commaSeparatedOrArrayEnum(DeploymentStatusSchema.enum).optional(),
  strategy: commaSeparatedOrArrayEnum(DeploymentStrategySchema.enum).optional(),
  search: z.string().optional(),
});

export const ContainerFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
  projectId: IdSchema.optional(),
  deploymentId: IdSchema.optional(),
  status: z.array(z.string()).optional(),
  name: z.string().optional(),
});

export const AuditLogQuerySchema = PaginationParamsSchema.extend({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  userId: IdSchema.optional(),
  projectId: IdSchema.optional(),
  since: TimestampSchema.optional(),
  until: TimestampSchema.optional(),
  search: z.string().optional(),
});

export const ServiceFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
  projectId: IdSchema.optional(),
  type: z.array(ServiceTypeSchema).optional(),
  status: z.array(z.string()).optional(),
  search: z.string().max(255).optional(),
});

export const ServiceConnectionQuerySchema = z.object({
  reveal: z.enum(["true", "false"]).optional().default("false"),
});

export const AlertFiltersSchema = PaginationParamsSchema.extend({
  projectId: IdSchema.optional(),
  status: z
    .union([AlertStatusSchema, z.array(AlertStatusSchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .pipe(z.array(AlertStatusSchema))
    .optional(),
  severity: z
    .union([AlertSeveritySchema, z.array(AlertSeveritySchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .pipe(z.array(AlertSeveritySchema))
    .optional(),
});

export const AlertRuleFiltersSchema = PaginationParamsSchema.extend({
  projectId: IdSchema.optional(),
  enabled: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === true || v === "true")
    .optional(),
  severity: z
    .union([AlertSeveritySchema, z.array(AlertSeveritySchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .pipe(z.array(AlertSeveritySchema))
    .optional(),
});

export const AlertChannelFiltersSchema = PaginationParamsSchema.extend({
  projectId: IdSchema.optional(),
  type: z
    .union([ChannelTypeSchema, z.array(ChannelTypeSchema)])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .pipe(z.array(ChannelTypeSchema))
    .optional(),
});
