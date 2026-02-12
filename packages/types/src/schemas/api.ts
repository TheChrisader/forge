import { z } from "zod";

export const ResponseMetaSchema = z.object({
  total: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  totalPages: z.number().int().nonnegative().optional(),
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
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  });
}

export const ErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    statusCode: z.number().int().optional(),
    details: z.unknown().optional(),
  }),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
