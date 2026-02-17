import { z } from "zod";

export const IdSchema = z.uuid();
export const TimestampSchema = z.iso.datetime({ offset: true });
export const NonEmptyStringSchema = z.string().min(1);

export const MetadataSchema = z.record(z.string(), z.unknown());

export const ConfigSchema = z.record(z.string(), z.unknown());

export const LogLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);
export const SourceTypeSchema = z.enum(["container", "service", "system"]);
export const ServiceTypeSchema = z.enum(["database", "cache", "queue", "storage", "custom"]);
export const ServiceStatusSchema = z.enum(["creating", "running", "stopped", "error"]);
export const JobEntityStatusSchema = z.enum(["idle", "running", "success", "failed"]);
export const DeploymentStrategySchema = z.enum(["rolling", "blue-green", "canary"]);
export const HealthStatusSchema = z.enum(["healthy", "unhealthy", "starting", "none"]);
export const SortOrderSchema = z.enum(["asc", "desc"]);

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const SortParamsSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
});
