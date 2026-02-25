import { z } from "zod";

import { LogLevelSchema, BuildLogSourceSchema } from "./common";

export const ResponseMetaSchema = z.object({
  total: z.int().nonnegative().optional(),
  page: z.int().positive().optional(),
  limit: z.int().positive().optional(),
  totalPages: z.int().nonnegative().optional(),
});

export function ApiResponseSchema<T extends z.ZodType>(
  dataSchema: T
): z.ZodObject<
  {
    data: T;
    meta: z.ZodOptional<
      z.ZodObject<
        {
          total: z.ZodOptional<z.ZodNumber>;
          page: z.ZodOptional<z.ZodNumber>;
          limit: z.ZodOptional<z.ZodNumber>;
          totalPages: z.ZodOptional<z.ZodNumber>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
> {
  return z.object({
    data: dataSchema,
    meta: ResponseMetaSchema.optional(),
  });
}

export function PaginatedResponseSchema<T extends z.ZodType>(
  itemSchema: T
): z.ZodObject<
  {
    data: z.ZodArray<T>;
    meta: z.ZodObject<
      {
        total: z.ZodNumber;
        page: z.ZodNumber;
        limit: z.ZodNumber;
        totalPages: z.ZodNumber;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
> {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      total: z.int().nonnegative(),
      page: z.int().positive(),
      limit: z.int().positive(),
      totalPages: z.int().nonnegative(),
    }),
  });
}

export const ErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
    statusCode: z.int(),
    details: z.unknown().optional(),
  }),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const CacheStatsSchema = z.object({
  totalEntries: z.int().nonnegative(),
  totalSizeBytes: z.int().nonnegative(),
  averageAgeDays: z.number().nonnegative(),
  oldestEntry: z.coerce.date().optional(),
});

export const CacheClearResultSchema = z.object({
  deleted: z.int().nonnegative(),
  freedBytes: z.int().nonnegative(),
});

export type CacheClearResult = z.infer<typeof CacheClearResultSchema>;

export const DeploymentLogsQuerySchema = z.object({
  fromLine: z.coerce.number().int().nonnegative().optional(),
  toLine: z.coerce.number().int().nonnegative().optional(),
  level: LogLevelSchema.optional(),
  source: BuildLogSourceSchema.optional(),
  search: z.string().optional(),
  tail: z.coerce.number().int().positive().default(100),
});

export const DeploymentLogsResponseSchema = z.object({
  logs: z.array(
    z.object({
      id: z.string().uuid(),
      deploymentId: z.string().uuid(),
      lineNumber: z.number().int().nonnegative(),
      timestamp: z.coerce.date(),
      message: z.string(),
      level: LogLevelSchema,
      source: BuildLogSourceSchema,
    })
  ),
  total: z.number().int().nonnegative(),
  metadata: z.object({
    fromLine: z.number().int().nonnegative(),
    toLine: z.number().int().nonnegative(),
    count: z.number().int().nonnegative(),
  }),
});

export type DeploymentLogsQuery = z.infer<typeof DeploymentLogsQuerySchema>;
export type DeploymentLogsResponse = z.infer<typeof DeploymentLogsResponseSchema>;
