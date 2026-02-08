import { z } from "zod";
import type { ErrorResponse } from "../api";

export class ValidationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    fieldErrors: Record<string, string> = {},
    code: string = "VALIDATION_ERROR",
    statusCode: number = 400
  ) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  toErrorResponse(): ErrorResponse {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.fieldErrors,
      },
    };
  }
}

export function parseAndThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "Validation failed",
      flattenZodErrors(result.error),
      "VALIDATION_ERROR",
      400
    );
  }
  return result.data;
}

export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: new ValidationError(
        "Validation failed",
        flattenZodErrors(result.error),
        "VALIDATION_ERROR",
        400
      ),
    };
  }
  return { success: true, data: result.data };
}

export async function parseAndThrowAsync<T>(schema: z.ZodType<T>, data: unknown): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        "Validation failed",
        flattenZodErrors(error),
        "VALIDATION_ERROR",
        400
      );
    }
    throw error;
  }
}

export function toErrorResponse(error: ValidationError): ErrorResponse {
  return error.toErrorResponse();
}

export function parseArray<T>(schema: z.ZodType<T>, data: unknown[]): T[] {
  return z.array(schema).parse(data);
}

function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "value";
    fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}
