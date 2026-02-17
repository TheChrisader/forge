import { z } from "zod";
import {
  IdSchema,
  LogLevelSchema,
  PaginationParamsSchema,
  ServiceTypeSchema,
  SortOrderSchema,
  SourceTypeSchema,
  TimestampSchema,
} from "./common";
import { ProjectStatusSchema } from "./entities";

// =============================================================================
// Log Query Schemas
// =============================================================================

export const LogQueryParamsSchema = PaginationParamsSchema.extend({
  since: TimestampSchema.optional(),
  until: TimestampSchema.optional(),
  level: z.union([LogLevelSchema, z.array(LogLevelSchema)]).optional(),
  sourceType: SourceTypeSchema.optional(),
  sourceId: z.string().optional(),
  search: z.string().optional(),
});

// =============================================================================
// Metric Query Schemas
// =============================================================================

const MetricAggregationSchema = z.enum(["avg", "sum", "min", "max", "count"]);

export const MetricQueryParamsSchema = z.object({
  source: z.string().optional(),
  metric: z.string().optional(),
  from: TimestampSchema,
  to: TimestampSchema,
  interval: z.string().optional(),
  aggregation: MetricAggregationSchema.optional(),
});

// =============================================================================
// Project Query Schemas
// =============================================================================

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

/**
 * Helper schema that accepts either:
 * - A comma-separated string (e.g., "ACTIVE,ARCHIVED")
 * - An array of strings from repeated query params (e.g., ?status=ACTIVE&status=ARCHIVED)
 */
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

/**
 * Query parameters for listing projects via API
 * Supports both comma-separated (?status=ACTIVE,ARCHIVED) and
 * repeated query params (?status=ACTIVE&status=ARCHIVED)
 */
export const ProjectListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: commaSeparatedOrArrayEnum(ProjectStatusSchema.enum).optional(),
});

/**
 * Query parameters for getting a single project via API
 */
export const ProjectIdParamsSchema = z.object({
  id: IdSchema,
});

// =============================================================================
// Deployment Query Schemas
// =============================================================================

export const DeploymentFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
  projectId: IdSchema.optional(),
  status: z.array(z.string()).optional(),
  version: z.string().optional(),
});

// =============================================================================
// Container Query Schemas
// =============================================================================

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

// =============================================================================
// Service Query Schemas
// =============================================================================

export const ServiceFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
  projectId: IdSchema.optional(),
  type: z.array(ServiceTypeSchema).optional(),
  status: z.array(z.string()).optional(),
});
