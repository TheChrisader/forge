/**
 * Base error class for all Forge-specific errors
 */
export class ForgeError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Serialize error to JSON for API responses
   */
  toJSON(): { code: string; statusCode: number; message: string; details?: unknown } {
    const json: {
      code: string;
      statusCode: number;
      message: string;
      details?: unknown;
    } = {
      code: this.code,
      statusCode: this.statusCode,
      message: this.message,
    };

    if (this.details !== undefined) {
      json.details = this.details;
    }

    return json;
  }
}

/**
 * 400 Bad Request - Input validation failures
 * Used when request payload doesn't match expected schema or format
 */
export class ValidationError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

/**
 * 400 Bad Request - Malformed requests
 * Used when request structure is invalid or missing required fields
 */
export class BadRequestError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("BAD_REQUEST", 400, message, details);
  }
}

/**
 * 401 Unauthorized - Authentication missing or invalid
 * Used when credentials are missing, expired, or incorrect
 */
export class UnauthorizedError extends ForgeError {
  constructor(message: string = "Authentication required", details?: unknown) {
    super("UNAUTHORIZED", 401, message, details);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 * Used when user is authenticated but lacks required permissions
 */
export class ForbiddenError extends ForgeError {
  constructor(message: string = "Insufficient permissions", details?: unknown) {
    super("FORBIDDEN", 403, message, details);
  }
}

/**
 * 404 Not Found - Resource not found
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends ForgeError {
  constructor(resource: string = "Resource", details?: unknown) {
    super("NOT_FOUND", 404, `${resource} not found`, details);
  }
}

/**
 * 409 Conflict - State conflicts
 * Used for duplicate resources, version conflicts, etc.
 */
export class ConflictError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", 409, message, details);
  }
}

/**
 * 422 Unprocessable Entity - Semantic errors
 * Used when request is well-formed but contains semantic errors
 */
export class UnprocessableError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("UNPROCESSABLE_ENTITY", 422, message, details);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 * Used when client has exceeded rate limit
 */
export class RateLimitError extends ForgeError {
  constructor(message: string = "Rate limit exceeded", details?: unknown) {
    super("RATE_LIMIT_EXCEEDED", 429, message, details);
  }
}

/**
 * 500 Internal Server Error - Generic server errors
 * Used for unexpected server errors
 */
export class InternalError extends ForgeError {
  constructor(message: string = "Internal server error", details?: unknown) {
    super("INTERNAL_ERROR", 500, message, details);
  }
}

/**
 * 500 Internal Server Error - Deployment-specific failures
 * Used for deployment operation failures
 */
export class DeploymentError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("DEPLOYMENT_ERROR", 500, message, details);
  }
}

/**
 * 500 Internal Server Error - Build-specific failures
 * Used for build operation failures
 */
export class BuildError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("BUILD_ERROR", 500, message, details);
  }
}

/**
 * Type guard to check if an error is a ForgeError instance
 * Used by global error handler to determine if error needs special handling
 */
export function isForgeError(err: unknown): err is ForgeError {
  return err instanceof ForgeError;
}
